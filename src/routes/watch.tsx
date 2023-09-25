import Description from "~/components/Description";
import {
  Show,
  createEffect,
  createSignal,
  onMount,
  untrack,
  useContext,
  Switch,
  Match,
} from "solid-js";
import { useLocation } from "solid-start";
import { For } from "solid-js";
import { PlayerContext, useTheater } from "~/root";
import VideoCard from "~/components/VideoCard";
import { videoId } from "~/routes/library/history";
import { getHlsManifest, getStreams } from "~/utils/hls";
import PlaylistItem from "~/components/PlaylistItem";
import { createVirtualizer, elementScroll } from "@tanstack/solid-virtual";
import { classNames, fetchJson } from "~/utils/helpers";
import { usePlaylist } from "~/stores/playlistStore";
import { useSyncStore } from "~/stores/syncStore";
import type { Virtualizer, VirtualizerOptions } from "@tanstack/virtual-core";
import Button from "~/components/Button";
import { useAppState } from "~/stores/appStateStore";
import PlayerContainer from "~/components/PlayerContainer";
import { createQuery } from "@tanstack/solid-query";
import { Chapter, PipedVideo, RelatedPlaylist } from "~/types";
import { usePreferences } from "~/stores/preferencesStore";
import { Suspense } from "solid-js";
import numeral from "numeral";
import { isServer } from "solid-js/web";
import PlaylistCard from "~/components/PlaylistCard";

export interface SponsorSegment {
  category: string;
  actionType: string;
  segment: number[];
  UUID: string;
  videoDuration: number;
  locked: number;
  votes: number;
  description: string;
}

export function extractVideoId(url: string | undefined): string | undefined {
  let id;
  if (url?.includes("/watch?v=")) {
    id = url.split("/watch?v=")[1];
  } else {
    id = url?.match("vi(?:_webp)?/([a-zA-Z0-9_-]{11})")?.[1];
  }
  return id ?? undefined;
}
export async function fetchWithTimeout(
  resource: string,
  options: RequestInit & { timeout: number } = { timeout: 800 }
) {
  const { timeout } = options;

  const controller = new AbortController();
  const id = setTimeout(() => {
    console.log("aborting");
    controller.abort(`Request exceeded timeout of ${timeout}ms.`);
  }, timeout);
  console.log("fetching", controller.signal);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  return response;
}

const VIDEO_CARD_WIDTH = 300;
const PLAYLIST_WIDTH = 400;

export default function Watch() {
  console.log(new Date().toISOString().split("T")[1], "rendering watch page");

  const [video, setVideo] = useContext(PlayerContext);
  const route = useLocation();
  const [theater] = useTheater();

  const [playlist, setPlaylist] = usePlaylist();

  const [videoDownloaded, setVideoDownloaded] = createSignal(true);
  createEffect(async () => {
    if (!route.query.v) return;
    console.time("verifyDownloaded");
    if (!("getDirectory" in navigator.storage)) {
      setVideoDownloaded(false);
      return;
    }
    try {
      const downloaded = await getStreams(route.query.v);
      console.log("downloaded", downloaded);
      if (downloaded) {
        console.log("video downloaded");
        const manifest = await getHlsManifest(route.query.v);
        setVideo({
          value: {
            ...downloaded,
            hls: manifest,
          },
        });
        console.log(video.value, "previewFrames");
        return;
      } else {
        console.log("video not downloaded");
        setVideoDownloaded(false);
        console.timeEnd("verifyDownloaded");
      }
    } catch (e) {
      console.log(e);
      setVideoDownloaded(false);
      return;
    }
  });

  const [appState, setAppState] = useAppState();
  const sync = useSyncStore();
  const [preferences] = usePreferences();
  const isLocalPlaylist = () => route.query.list?.startsWith("conduit-");

  const videoQuery = createQuery(
    () => ["streams", route.query.v, preferences.instance.api_url],
    async (): Promise<PipedVideo> =>
      await fetch(
        preferences.instance.api_url + "/streams/" + route.query.v
      ).then((res) => {
        if (!res.ok) throw new Error("video not found");
        return res.json();
      }),
    {
      get enabled() {
        return preferences.instance?.api_url &&
          !isServer &&
          route.query.v &&
          !videoDownloaded()
          ? true
          : false;
      },
      refetchOnReconnect: false,
    }
  );
  const [shouldFetchSponsors, setShouldFetchSponsors] = createSignal(false);
  createEffect(() => {
    if (videoQuery.isSuccess) {
      setShouldFetchSponsors(true);
    }
  });
  const sponsorsQuery = createQuery<SponsorSegment[]>(
    () => ["sponsors", route.query.v, preferences.instance.api_url],
    async (): Promise<SponsorSegment[]> => {
      const sha256Encrypted = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(route.query.v)
      );
      const sha256Array = Array.from(new Uint8Array(sha256Encrypted));
      const prefix = sha256Array
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 5);
      const urlObj = new URL(
        "https://sponsor.ajay.app/api/skipSegments/" + prefix
      );
      // urlObj.searchParams.set("videoID", route.query.v);
      urlObj.searchParams.set(
        "categories",
        JSON.stringify([
          "sponsor",
          "interaction",
          "selfpromo",
          "music_offtopic",
        ])
      );
      const url = urlObj.toString();
      console.log(url);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch sponsors");
      }
      const data = await res.json();
      console.log(data);
      const video = data.find((v: any) => v.videoID === route.query.v);
      console.log(video, "Sponsors");
      if (!video) {
        throw new Error("Failed to fetch sponsors");
      }
      return video.segments;
    },
    {
      get enabled() {
        return preferences.instance?.api_url && shouldFetchSponsors()
          ? // videoQuery.data
            true
          : false;
      },
      refetchOnReconnect: false,
      retry: false,
    }
  );
  const playlistQuery = createQuery(
    () => ["playlist", route.query.list, preferences.instance.api_url],
    async () => {
      const res = await fetch(
        `${preferences.instance.api_url}/playlists/${route.query.list}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch playlist");
      }
      return await res.json();
    },
    {
      get enabled() {
        return preferences.instance?.api_url &&
          route.query.list &&
          !isLocalPlaylist()
          ? true
          : false;
      },
      refetchOnReconnect: false,
    }
  );
  createEffect(() => {
    console.log(sponsorsQuery.data, sponsorsQuery.error);
  });

  createEffect(() => {
    if (playlistQuery.isSuccess) {
      setPlaylist(playlistQuery.data);
    } else {
      setPlaylist(undefined);
    }
  });

  const mergeChaptersAndSponsors = (
    chapters: Chapter[],
    sponsors: SponsorSegment[]
  ): Chapter[] => {
    const sortedChapters = [...chapters].sort((a, b) => a.start - b.start);
    const sortedSponsors = [...sponsors].sort(
      (a, b) => a.segment[0] - b.segment[0]
    );

    const result: Chapter[] = [];

    let chapterIndex = 0;
    let sponsorIndex = 0;

    while (
      chapterIndex < sortedChapters.length ||
      sponsorIndex < sortedSponsors.length
    ) {
      const currentChapter = sortedChapters[chapterIndex];
      const currentSponsor = sortedSponsors[sponsorIndex];
      const nextChapter = sortedChapters[chapterIndex];

      const nextSegmentStart = nextChapter?.start ?? Number.MAX_SAFE_INTEGER;

      if (
        currentChapter &&
        (!currentSponsor || currentChapter.start <= currentSponsor.segment[0])
      ) {
        result.push(currentChapter);
        chapterIndex++;
      } else if (currentSponsor) {
        result.push({
          title: `Sponsor: ${currentSponsor.category}`,
          start: currentSponsor.segment[0],
        } as Chapter);

        if (Math.abs(nextSegmentStart - currentSponsor.segment[1]) >= 5) {
          console.log(
            "Next chapter is more than 5s after end of sponsor, adding chapter. ",
            "next segment start is: ",
            numeral(nextSegmentStart).format("00:00:00"),
            "current sponsor end is: ",
            numeral(currentSponsor.segment[1]).format("00:00:00"),
            "absolute value is: ",
            Math.abs(nextSegmentStart - currentSponsor.segment[1])
          );
          result.push({
            title: `End Sponsor: ${currentSponsor.category}`,
            start: currentSponsor.segment[1],
          } as Chapter);
        }

        sponsorIndex++;
      }
    }

    return result;
  };
  createEffect(() => {
    console.log(sponsorsQuery.data);
    if (!sponsorsQuery.data) return;
    const video = untrack(() => videoQuery.data);
    if (!video) return;
    const mergedChapters = mergeChaptersAndSponsors(
      video.chapters,
      sponsorsQuery.data
    );
    console.log(mergedChapters);
    setVideo("value", "chapters", mergedChapters);
  });

  createEffect(() => {
    setAppState({
      loading:
        videoQuery.isInitialLoading ||
        videoQuery.isFetching ||
        videoQuery.isRefetching,
    });
  });

  createEffect(() => {
    if (videoQuery.data) {
      setVideo({ value: videoQuery.data });
    }
  });
  createEffect(() => {
    if (!video.value) return;
    document.title = `${video.value?.title} - Conduit`;
  });

  const [listId, setListId] = createSignal<string | undefined>(undefined);
  createEffect(() => {
    if (!route.query.list) {
      setPlaylist(undefined);
      return;
    }
  });

  // createEffect(async () => {
  //   if (!route.query.list) return;
  //   if (isLocalPlaylist()) return;
  //   const json = await fetchJson(
  //     `${instance().api_url}/playlists/${route.query.list}`
  //   );
  //   setPlaylist({ ...json, id: route.query.list });
  //   console.log(json);
  // });
  createEffect(async () => {
    if (!route.query.list) {
      setPlaylist(undefined);
      console.log("fetching playlistno list id");
      return;
    }
    if (!isLocalPlaylist()) return;
    console.log("fetching playlist");
    setListId(route.query.list);
    console.log("fetching playlistlist id", listId());
    if (!listId()) return;
    const list = sync.store.playlists[listId()!];
    console.log("setting playlist", list);
    setPlaylist(list);
  });

  return (
    <div
      class="flex"
      classList={{
        "flex-col": theater(),
        "flex-col lg:flex-row": !theater(),
      }}
    >
      <div
        class="flex flex-col"
        classList={{
          "flex-grow": !theater(),
          "w-full": theater(),
        }}
      >
        <PlayerContainer
          loading={videoQuery.isLoading}
          error={videoQuery.error}
          video={videoQuery.data}
          onReload={() => videoQuery.refetch()}
        />
        <Show when={!theater()}>
          <div>
            <Suspense fallback="Watch page loading">
              <Description
                video={video.value}
                downloaded={videoDownloaded()}
                onRefetch={() => videoQuery.refetch()}
              />
            </Suspense>
          </div>
        </Show>
      </div>
      <div
        class="flex flex-col"
        classList={{
          "flex-col": !theater(),
          "lg:flex-row": theater(),
          "w-full": theater(),
        }}
      >
        <Show when={theater()}>
          <div class="w-full max-w-full">
            <Suspense fallback="Watch page loading">
              <Description
                video={video.value}
                downloaded={videoDownloaded()}
                onRefetch={() => videoQuery.refetch()}
              />
            </Suspense>
          </div>
        </Show>
        <div
          class={`flex flex-col gap-2 items-center w-full min-w-0 max-w-max`}
        >
          <Show when={playlist()} keyed>
            {(list) => (
              <div
                role="group"
                aria-label="Playlist"
                class="overflow-hidden rounded-xl w-full p-2 max-w-[400px] min-w-0"
              >
                <div class="relative flex flex-col gap-2 min-w-full md:min-w-[20rem] w-full bg-bg2 max-h-[30rem] px-1 overflow-y-auto scrollbar">
                  <h3 class="sticky top-0 left-0 z-10 text-lg font-bold sm:text-xl ">
                    {list.name} - {route.query.index} /{" "}
                    {list.relatedStreams.length}
                  </h3>
                  <For each={list.relatedStreams}>
                    {(item, index) => {
                      return (
                        <PlaylistItem
                          list={route.query.list}
                          index={index() + 1}
                          v={item}
                          active={route.query.index ?? 1}
                        />
                      );
                    }}
                  </For>
                </div>
              </div>
            )}
          </Show>
          <Show
            when={video.value}
            keyed
            fallback={<For each={Array(20).fill(0)}>{() => <VideoCard />}</For>}
          >
            <Show when={video.value?.relatedStreams}>
              <div class="w-full max-w-max">
                <For each={video.value?.relatedStreams}>
                  {(stream) => {
                    return (
                      <Switch>
                        <Match when={stream.type === "stream"}>
                          <VideoCard v={stream} />
                        </Match>
                        <Match when={stream.type === "playlist"}>
                          <PlaylistCard
                            item={stream as unknown as RelatedPlaylist}
                          />
                        </Match>
                      </Switch>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
