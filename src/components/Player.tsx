// Import styles.
import "vidstack/player/styles/base.css";
// Register elements.
import "vidstack/player";
import "vidstack/player/ui";
import "vidstack/solid";
import "vidstack/icons";

import {
  HLSErrorEvent,
  MediaProviderChangeEvent,
  isHLSProvider,
} from "vidstack";
import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  untrack,
} from "solid-js";
import { PlayerContext } from "~/root";
import {
  Chapter,
  PipedVideo,
  PreviewFrame,
  RelatedStream,
  Subtitle,
} from "~/types";
import { chaptersVtt } from "~/lib/chapters";
import { useIsRouting, useLocation, useNavigate, useSearchParams } from "solid-start";
import { ttml2srt } from "~/lib/ttml";
import PlayerSkin from "./PlayerSkin";
import VideoCard from "./VideoCard";
import { videoId } from "~/routes/library/history";
import { useQueue, VideoQueue } from "~/stores/queueStore";
import { usePlaylist } from "~/stores/playlistStore";
import { HistoryItem, useSyncStore } from "~/stores/syncStore";
import { usePlayerState } from "../stores/playerStateStore";
import { MediaRemoteControl } from "vidstack";
import { toaster } from "@kobalte/core";
import { Suspense } from "solid-js";
import { isServer } from "solid-js/web";
import { MediaPlayerElement } from "vidstack/elements";
import { VideoLayout } from "./player/layouts/VideoLayout";
import { usePreferences } from "~/stores/preferencesStore";
import { createQuery } from "@tanstack/solid-query";
import { Spinner } from "./PlayerContainer";

export default function Player(props: {
  // video: PipedVideo;
  onReload?: () => void;
}) {
  console.log("player render");
  const route = useLocation();
  let mediaPlayer!: MediaPlayerElement;
  const sync = useSyncStore();
  const [preferences, setPreferences] = usePreferences();
  const [v, setV] = createSignal<string | undefined>(undefined);
  createEffect(() => {
    if (!route.query.v) return;
    setV(route.query.v);
  });
  const videoQuery = createQuery(
    () => ["streams", v(), preferences.instance.api_url],
    async (): Promise<PipedVideo> =>
      await fetch(
        preferences.instance.api_url + "/streams/" + v()
      ).then((res) => {
        if (!res.ok) throw new Error("video not found");
        return res.json();
      }),
    {
      get enabled() {
        return preferences.instance?.api_url &&
          !isServer &&
          v()
          ? true
          : false;
      },
      refetchOnReconnect: false,
      refetchOnMount: false,
      cacheTime: Infinity,
      staleTime: 100 * 60 * 1000,
    }
  );
  const updateProgress = async () => {
    if (!videoQuery.data) return;
    if (!started()) {
      return;
    }
    let currentTime = mediaPlayer?.currentTime;
    if (videoQuery.data.category === "Music") {
      currentTime = 0;
    }
    const id = videoId(videoQuery.data);
    if (!id) return;
    console.time("updating progress");

    const val = {
      title: videoQuery.data.title,
      duration: videoQuery.data.duration,
      thumbnail: videoQuery.data.thumbnailUrl,
      uploaderName: videoQuery.data.uploader,
      uploaderAvatar: videoQuery.data.uploaderAvatar,
      uploaderUrl: videoQuery.data.uploaderUrl,
      url: `/watch?v=${id}`,
      currentTime: currentTime ?? videoQuery.data.duration,
      watchedAt: new Date().getTime(),
      type: "stream",
      uploaded: new Date(videoQuery.data.uploadDate).getTime(),
      uploaderVerified: videoQuery.data.uploaderVerified,
      views: videoQuery.data.views,
    };
    console.log("updating progress", val);

    setTimeout(() => {
      if (sync.store.history[id]) {
        sync.setStore("history", id, "currentTime", currentTime);
        sync.setStore("history", id, "watchedAt", new Date().getTime());
      } else {
        sync.setStore("history", id, val);
      }
      console.timeEnd("updating progress");
    }, 0);
  };
  const state = usePlayerState();


  const [playlist] = usePlaylist();
  let queue = new VideoQueue([]);

  // const queueStore = useQueue();
  createEffect(() => {
    if (!videoQuery.data) return;
    if (queue.isEmpty()) {
      queue.add({
        url: `/watch?v=${videoId(videoQuery.data)}`,
        title: videoQuery.data.title,
        thumbnail: videoQuery.data.thumbnailUrl,
        duration: videoQuery.data.duration,
        uploaderName: videoQuery.data.uploader,
        uploaderAvatar: videoQuery.data.uploaderAvatar,
        uploaderUrl: videoQuery.data.uploaderUrl,
        isShort: false,
        shortDescription: "",
        type: "video",
        uploaded: new Date(videoQuery.data.uploadDate).getTime(),
        views: videoQuery.data.views,
        uploadedDate: videoQuery.data.uploadDate,
        uploaderVerified: videoQuery.data.uploaderVerified,
      });
    }
  });

  const [vtt, setVtt] = createSignal<string | undefined>(undefined);

  const [tracks, setTracks] = createSignal<
    {
      id: string;
      key: string;
      kind: string;
      src: string;
      srcLang: string;
      label: string;
      dataType: string;
      metadata: {
        url: string;
      };
    }[]
  >([]);

  const [subtitles, setSubtitles] = createSignal<Map<string, string>>();

  const fetchSubtitles = async (subtitles: Subtitle[]) => {
    console.time("fetching subtitles");
    const newTracks = await Promise.all(
      subtitles.map(async (subtitle) => {
        if (!subtitle.url) return null;
        if (subtitle.mimeType !== "application/ttml+xml")
          return {
            id: `track-${subtitle.code}`,
            key: subtitle.url,
            kind: "subtitles",
            src: subtitle.url,
            srcLang: subtitle.code,
            label: `${subtitle.name} - ${subtitle.autoGenerated ? "Auto" : ""}`,
            dataType: subtitle.mimeType,
          };
        // const { srtUrl, srtText } = await ttml2srt(subtitle.url);
        // remove empty subtitles
        // if (srtText.trim() === "") return null;
        return {
          id: `track-${subtitle.code}`,
          key: subtitle.url,
          kind: "subtitles",
          src: "",
          srcLang: subtitle.code,
          label: `${subtitle.name} - ${subtitle.autoGenerated ? "Auto" : ""}`,
          dataType: "srt",
          metadata: {
            url: subtitle.url,
          },
        };
      })
    );
    console.timeEnd("fetching subtitles");
    setTracks(newTracks.filter((track) => track !== null) as any);
  };

  const initMediaSession = () => {
    if (!navigator.mediaSession) return;
    if (!videoQuery.data) return;
    if (!mediaPlayer) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: videoQuery.data.title,
      artist: videoQuery.data.uploader,
      artwork: [
        {
          src: videoQuery.data?.thumbnailUrl,
          sizes: "128x128",
          type: "image/png",
        },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      mediaPlayer?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      mediaPlayer?.pause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      mediaPlayer!.currentTime -= 10;
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      mediaPlayer!.currentTime += 10;
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      mediaPlayer!.currentTime -= 10;
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      mediaPlayer!.currentTime += 10;
    });
    navigator.mediaSession.setActionHandler("stop", () => {
      console.log("stop");
    });
  };

  function yieldToMain() {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  const init = async () => {
    if (!videoQuery.data) throw new Error("No video");
    console.time("init");
    initMediaSession();
    await yieldToMain();
    fetchSubtitles(videoQuery.data.subtitles);
    if (!videoQuery.data?.subtitles) return;
    const subs = new Map<string, string>();
    videoQuery.data.subtitles.forEach((subtitle) => {
      if (!subtitle.url) return;
      subs.set(subtitle.code, subtitle.url);
    });
    setSubtitles(subs);
  };

  const [currentTime, setCurrentTime] = createSignal(0);
  const time = route.query.t;
  const [started, setStarted] = createSignal(false);

  const onCanPlay = (event: Event) => {
    console.log("can play", route.search.match("fullscreen"));
    console.log(event);
    setErrors([]);
    init();
    if (!videoQuery.data?.chapters) return;
    if (!mediaPlayer) return;
    if (route.search.match("fullscreen")) {
      //@ts-ignore
      // if (navigator.userActivation.isActive) {
      mediaPlayer?.requestFullscreen();
      // }
    }
    let chapters = [];
    for (let i = 0; i < videoQuery.data.chapters.length; i++) {
      const chapter = videoQuery.data.chapters[i];
      const name = chapter.title;
      // seconds to 00:00:00
      const timestamp = new Date(chapter.start * 1000)
        .toISOString()
        .slice(11, 22);
      const seconds =
        videoQuery.data.chapters[i + 1]?.start - chapter.start ??
        videoQuery.data.duration - chapter.start;
      chapters.push({ name, timestamp, seconds });
    }

    console.time("chapters vtt");
    setVtt(chaptersVtt(chapters, videoQuery.data.duration));
    if (vtt()) {
      mediaPlayer.textTracks.add({
        kind: "chapters",
        default: true,
        content: vtt(),
        type: "vtt",
      });
    }
    console.timeEnd("chapters vtt");

    if (time) {
      let start = 0;
      if (/^[\d]*$/g.test(time)) {
        start = parseInt(time);
      } else {
        const hours = /([\d]*)h/gi.exec(time)?.[1];
        const minutes = /([\d]*)m/gi.exec(time)?.[1];
        const seconds = /([\d]*)s/gi.exec(time)?.[1];
        if (hours) {
          start += parseInt(hours) * 60 * 60;
        }
        if (minutes) {
          start += parseInt(minutes) * 60;
        }
        if (seconds) {
          start += parseInt(seconds);
        }
      }
      setCurrentTime(start);
    }
    handleSetNextVideo();
    handleSetPrevVideo();
  };

  const [list, setList] = createSignal<RelatedStream[] | undefined>();

  createEffect(() => {
    console.log(nextVideo(), prevVideo());
    if (playlist()) {
      if (Array.isArray(playlist()!.videos)) {
        setList((playlist() as any).videos);
      } else {
        setList(playlist()!.relatedStreams);
      }
    } else {
      setList(queue.list());
    }
  });

  createEffect(() => {
    if (!videoQuery.data) return;
    if (!mediaPlayer) return;
    if (time) return;
    const id = videoId(videoQuery.data);
    if (!id) return;
    console.time("getting progress");
    const val = sync.store.history[id];
    const progress = val?.currentTime;
    if (progress) {
      if (progress < videoQuery.data.duration * 0.9) {
        setCurrentTime(progress);
      }
    }
    console.timeEnd("getting progress");
  });

  const [nextVideo, setNextVideo] = createSignal<{
    url: string;
    info: RelatedStream;
  } | null>(null);
  const [prevVideo, setPrevVideo] = createSignal<{
    url: string;
    info: RelatedStream;
  } | null>(null);

  createEffect(() => {
    const nextVideo = videoQuery.data?.relatedStreams?.[0];
    if (!nextVideo) return;
    if (!mediaPlayer) return;
    if (!videoQuery.data) return;
    if (route.query.list) return;
    if (!queue.next()) {
      console.log("adding next video to queue", nextVideo);
      queue.add(nextVideo);
      console.log("queue", queue);
    }
  });


  const [searchParams, setSearchParams] = useSearchParams();

  const playNext = () => {
    console.log("playing next", nextVideo());
    if (!nextVideo()) return;

    // navigate(nextVideo()!.url, { replace: true});
    // props.setVideoId(videoId(nextVideo()!.info));
    setSearchParams({ "v": videoId(nextVideo()!.info) });
    setEnded(false);
  };

  function handleSetNextVideo() {
    console.log("setting next queue video");
    const params = new URLSearchParams(window.location.search);
    let url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    for (let key of urlParams.keys()) {
      params.set(key, urlParams.get(key)!);
    }
    if (playlist()) {
      const local = "videos" in playlist()!;
      const listId = params.get("list")
        ?? (playlist() as unknown as { id: string })!.id;
      let index; // index starts from 1
      if (params.get("index")) {
        index = parseInt(params.get("index")!);
      } else if (local) {
        index = (playlist() as unknown as {
          videos: RelatedStream[];
        })!.videos!.findIndex((v) => videoId(v) === videoId(videoQuery.data));
        if (index !== -1) index++;
      } else {
        index = playlist()!.relatedStreams!.findIndex(
          (v) => videoId(v) === videoId(videoQuery.data)
        );
        if (index !== -1) index++;
      }

      if (index < playlist()!.relatedStreams?.length) {
        const next = playlist()!.relatedStreams[index]; // index is already +1
        const id = videoId(next);
        params.set("v", id);
        params.set("list", listId);
        params.set("index", (index + 1).toString());
        url.search = params.toString();
        setNextVideo({ url: (url.pathname + url.search.toString()), info: next });
      } else if (
        index <
        (playlist() as unknown as { videos: RelatedStream[] })!.videos?.length
      ) {
        const next = (playlist() as unknown as {
          videos: RelatedStream[];
        })!.videos[index]; // index is already +1
        const id = videoId(next);
        params.set("v", id);
        params.set("list", listId);
        params.set("index", (index + 1).toString());
        url.search = params.toString();
        setNextVideo({ url: (url.pathname + url.search.toString()), info: next });
      }
      return;
    }
    const next = queue.next();
    if (!next) return;
    const id = videoId(next);
    params.set("v", id);
    url.search = params.toString();
    console.log((url.pathname + url.search.toString()), "next video");
    setNextVideo({ url: (url.pathname + url.search.toString()), info: next });

  }

  const handleSetPrevVideo = () => {
    console.log("setting prev queue video");
    const params = new URLSearchParams(window.location.search);
    let url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    for (let key of urlParams.keys()) {
      params.set(key, urlParams.get(key)!);
    }
    if (params.get("list")) {
      if (params.get("index")) {
        const index = parseInt(params.get("index")!);
        if (index > 1) {
          if (Array.isArray(playlist()!.videos)) {
            const prev = (playlist() as any).videos[index - 2];
            const id = videoId(prev);
            params.set("v", id);
            params.set("index", (index - 1).toString());
            url.search = params.toString();
            setPrevVideo({ url: (url.pathname + url.search.toString()), info: prev });
          } else {
            const prev = playlist()!.relatedStreams![index - 2];
            const id = videoId(prev);
            params.set("v", id);
            params.set("index", (index - 1).toString());
            url.search = params.toString();
            setPrevVideo({ url: (url.pathname + url.search.toString()), info: prev });
          }
        }
      }
      return;
    }
    const prev = queue.prev();
    if (!prev) return;
    const id = videoId(prev);
    params.set("v", id);
    url.search = params.toString();
    setPrevVideo({ url: (url.pathname + url.search.toString()), info: prev });
  };


  const [ended, setEnded] = createSignal(false);

  const handleEnded = () => {
    console.log("ended");
    if (!mediaPlayer) return;
    if (!videoQuery.data) return;
    setEnded(true);
    showToast();
    updateProgress();
  };

  const [showEndScreen, setShowEndScreen] = createSignal(false);
  const defaultCounter = 5;
  const [counter, setCounter] = createSignal(defaultCounter);
  let timeoutCounter: any;

  function showToast() {
    console.log("showing toast");
    setCounter(defaultCounter);
    if (counter() < 1) {
      console.log("counter less than 1");
      playNext();
      return;
    }
    if (timeoutCounter) clearInterval(timeoutCounter);
    timeoutCounter = setInterval(() => {
      console.log("counting", counter());
      setCounter((c) => c - 1);
      if (counter() === 0) {
        dismiss();
        playNext();
      }
    }, 1000);
    console.log("showing end screen");
    setShowEndScreen(true);
  }

  function dismiss() {
    console.log("dismiss");
    clearInterval(timeoutCounter);
    setShowEndScreen(false);
  }

  onCleanup(() => {
    if (isServer) return;
    clearInterval(timeoutCounter);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const onProviderChange = async (event: MediaProviderChangeEvent) => {
    console.log(event, "provider change");
    const provider = event.detail;
    if (isHLSProvider(provider)) {
      provider.library = async () => await import("hls.js");
      console.log(provider);
      provider.config = {
        startLevel: 13,
      };
    }
  };

  const [errors, setErrors] = createSignal<
    {
      name: string;
      details: string;
      fatal: boolean;
      message: string;
      code: number | undefined;
    }[]
  >([]);
  const [showErrorScreen, setShowErrorScreen] = createSignal({
    show: false,
    dismissed: false,
  });
  const handleHlsError = (err: HLSErrorEvent) => {
    if (err.detail.fatal) {
      setShowErrorScreen((prev) => ({ ...prev, show: true }));
      if (errors().length < 10) {
        setErrors((prev) => [
          ...prev,
          {
            name: err.detail.error.name,
            code: err.detail.response?.code,
            details: err.detail.details,
            fatal: err.detail.fatal,
            message: err.detail.error.message,
          },
        ]);
      } else {
        setErrors((prev) => [
          ...prev.slice(1),
          {
            name: err.detail.error.name,
            code: err.detail.response?.code,
            details: err.detail.details,
            fatal: err.detail.fatal,
            message: err.detail.error.message,
          },
        ]);
      }
    }

    console.log(errors());
    //   mediaPlayer?.destroy();
  };

  function selectDefaultQuality() {
    let preferredQuality = 1080; // TODO: get from user settings
    if (!mediaPlayer) return;
    console.log(mediaPlayer.qualities);
    const q = mediaPlayer.qualities
      ?.toArray()
      .find((q) => q.height >= preferredQuality);
    console.log(q);
    if (q) {
      q.selected = true;
    }
  }
  createEffect(() => {
    if (!mediaPlayer) return;
    if (!videoQuery.data) return;
    selectDefaultQuality();
  });

  onMount(() => {
    if (isServer) return;
    console.log("mount", mediaPlayer);
    document.addEventListener("visibilitychange", updateProgress);
    document.addEventListener("pagehide", updateProgress);
  });

  onCleanup(() => {
    if (isServer) return;
    document.removeEventListener("visibilitychange", updateProgress);
    document.removeEventListener("pagehide", updateProgress);
  });

  createEffect(() => {
    if (!started()) return;
    updateProgress();
  });

  const isRouting = useIsRouting();
  const navigate = useNavigate();
  createEffect(() => {
    if (isRouting()) {
      console.log("routing");
      // if ("window" in globalThis) {
      //   // add fullscreen parameter
      //   const url = new URL(window.location.href);
      //   url.searchParams.set("fullscreen", "true");
      //   navigate(url.href.replace(url.origin, "").toString(), { replace: false});
      // }
      updateProgress();
    }
  });

  const generateStoryboard = (
    previewFrames: PreviewFrame | undefined
  ): string | null => {
    if (!previewFrames) return null;
    let output = "WEBVTT\n\n";
    let currentTime = 0;

    for (let url of previewFrames.urls) {
      for (let y = 0; y < previewFrames.framesPerPageY; y++) {
        for (let x = 0; x < previewFrames.framesPerPageX; x++) {
          if (
            currentTime >=
            previewFrames.totalCount * previewFrames.durationPerFrame
          ) {
            break;
          }

          let startX = x * previewFrames.frameWidth;
          let startY = y * previewFrames.frameHeight;

          output += `${formatTime(currentTime)} --> ${formatTime(
            currentTime + previewFrames.durationPerFrame
          )}\n`;
          output += `${url}#xywh=${startX},${startY},${previewFrames.frameWidth},${previewFrames.frameHeight}\n\n`;

          currentTime += previewFrames.durationPerFrame;
        }
      }
    }

    function formatTime(ms: number): string {
      let hours = Math.floor(ms / 3600000);
      ms -= hours * 3600000;
      let minutes = Math.floor(ms / 60000);
      ms -= minutes * 60000;
      let seconds = Math.floor(ms / 1000);
      ms -= seconds * 1000;

      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${ms
          .toString()
          .padStart(3, "0")}`;
    }

    const blob = new Blob([output], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  };
  const [mediaPlayerConnected, setMediaPlayerConnected] = createSignal(false);
  const [remote, setRemote] = createSignal<MediaRemoteControl | undefined>(
    undefined
  );

  createEffect(() => {
    if (!mediaPlayerConnected()) return;
    if (!videoQuery.data) return;
    document.addEventListener("keydown", handleKeyDown);
  });
  createEffect(() => {
    if (!mediaPlayer) return;
    setRemote(new MediaRemoteControl());
  });

  onCleanup(() => {
    if (isServer) return;
    document.removeEventListener("keydown", handleKeyDown);
  });


  const handleKeyDown = (e: KeyboardEvent) => {
    // if an input is focused
    if (document.activeElement?.tagName === "INPUT") return;
    switch (e.key) {
      case "f":
        if (document.fullscreenElement) {
          document.exitFullscreen();
          screen.orientation.unlock();
          setSearchParams({ fullscreen: undefined });
        } else {
          document.documentElement.requestFullscreen();
          screen.orientation.lock("landscape");
          setSearchParams({ fullscreen: true });
        }
        e.preventDefault();
        break;
      case "m":
        mediaPlayer!.muted = !mediaPlayer!.muted;
        e.preventDefault();
        break;
      case "j":
        mediaPlayer!.currentTime = Math.max(mediaPlayer!.currentTime - 10, 0);
        e.preventDefault();
        break;
      case "l":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = Math.min(
          mediaPlayer!.currentTime + 10,
          videoQuery.data.duration
        );
        e.preventDefault();
        break;
      case "c":
        const captions = mediaPlayer!.textTracks
          .toArray()
          .find(
            (t: any) => ((t.id.startsWith("track-")) && (
              t.language === "en" ||
              t.language === "en_US" ||
              t.language === "en_GB")
            )
          );
        if (captions) {
          console.log(captions.id);
          const trackUrl = tracks().find((t) => t.id === captions.id)?.metadata
            .url;

          console.log(trackUrl, "track url");
          if (trackUrl)
            ttml2srt(trackUrl, null).then(({ srtUrl }: { srtUrl: string }) => {
              (captions as any).src = srtUrl;

              captions.mode =
                captions.mode === "showing" ? "hidden" : "showing";
            });
        }
        e.preventDefault();
        break;
      case "k":
        if (mediaPlayer!.paused) {
          mediaPlayer!.play();
          setTimeout(() => {
            mediaPlayer.controls.hide(0);
          }, 100);
        } else mediaPlayer!.pause();
        e.preventDefault();
        break;
      case " ":
        e.preventDefault();
        console.log(document.activeElement?.tagName);
        if (document.activeElement?.tagName === "BUTTON") {
          (document.activeElement as HTMLButtonElement).click();
          return;
        }
        if (document.activeElement?.tagName.startsWith("MEDIA-")) return;
        if (mediaPlayer!.paused) mediaPlayer!.play();
        else mediaPlayer!.pause();
        break;
      case "ArrowUp":
        if (e.shiftKey) {
          mediaPlayer!.volume = Math.min(mediaPlayer!.volume + 0.05, 1);
          e.preventDefault();
        }
        break;
      case "ArrowDown":
        if (e.shiftKey) {
          mediaPlayer!.volume = Math.max(mediaPlayer!.volume - 0.05, 0);
          e.preventDefault();
        }
        break;
      case "ArrowLeft":
        if (e.shiftKey) {
          prevChapter();
        } else {
          if (document.activeElement?.tagName.startsWith("MEDIA-")) return;
          mediaPlayer!.currentTime = Math.max(mediaPlayer!.currentTime - 5, 0);
        }
        e.preventDefault();
        break;
      case "ArrowRight":
        if (e.shiftKey) {
          nextChapter();
        } else {
          mediaPlayer!.currentTime = mediaPlayer!.currentTime + 5;
        }
        e.preventDefault();
        break;
      case "0":
        mediaPlayer!.currentTime = 0;
        e.preventDefault();
        break;
      case "1":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.1;
        e.preventDefault();
        break;
      case "2":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.2;
        e.preventDefault();
        break;
      case "3":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.3;
        e.preventDefault();
        break;
      case "4":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.4;
        e.preventDefault();
        break;
      case "5":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.5;
        e.preventDefault();
        break;
      case "6":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.6;
        e.preventDefault();
        break;
      case "7":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.7;
        e.preventDefault();
        break;
      case "8":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.8;
        e.preventDefault();
        break;
      case "9":
        if (!videoQuery.data?.duration) return;
        mediaPlayer!.currentTime = videoQuery.data.duration * 0.9;
        e.preventDefault();
        break;
      case "N":
        if (e.shiftKey) {
          playNext();
          e.preventDefault();
        }
        break;
      case "Escape":
        if (showEndScreen() && nextVideo()) {
          dismiss();
          e.preventDefault();
        } else if (showErrorScreen().show) {
          setShowErrorScreen({ show: false, dismissed: true });
          e.preventDefault();
          // mediaPlayer?.exitFullscreen();
        }
        break;

      case ",":
        mediaPlayer!.currentTime -= 0.04;
        break;
      case ".":
        mediaPlayer!.currentTime += 0.04;
        break;
      case "R":
        if (e.shiftKey) {
          updateProgress();
          props.onReload?.();
          e.preventDefault();
        }
        break;


      // case "return":
      //   self.skipSegment(mediaPlayer!);
      //   break;
    }
  };
  interface Segment extends Chapter {
    end: number;
    manuallyNavigated: boolean;
    autoSkipped: boolean;
  }
  const [sponsorSegments, setSponsorSegments] = createSignal<Segment[]>([]);
  createEffect(() => {
    if (!videoQuery.data?.chapters) return;
    const segments: Segment[] = [];

    for (let i = 0; i < videoQuery.data.chapters.length; i++) {
      const chapter = videoQuery.data.chapters[i];
      if (chapter.title.startsWith("Sponsor")) {
        segments.push({
          ...chapter,
          end: videoQuery.data.chapters[i + 1]?.start || videoQuery.data.duration,
          manuallyNavigated: false,
          autoSkipped: false,
        });
      }
    }
    setSponsorSegments(segments);
  });

  const autoSkipHandler = () => {
    if (!mediaPlayer) return;
    if (sponsorSegments().length === 0) return;
    const currentTime = mediaPlayer.currentTime;
    let segments = sponsorSegments();
    for (const segment of segments) {
      if (
        currentTime >= segment.start &&
        currentTime < segment.end &&
        !segment.manuallyNavigated &&
        !segment.autoSkipped
      ) {
        mediaPlayer.currentTime = segment.end;
        segment.autoSkipped = true; // Mark as automatically skipped
        break;
      }
    }
    setSponsorSegments(segments);
  };

  const userNavigationHandler = () => {
    if (!mediaPlayer) return;
    if (sponsorSegments().length === 0) return;

    const currentTime = mediaPlayer.currentTime;
    let segments = sponsorSegments();
    for (const segment of segments) {
      if (currentTime >= segment.start && currentTime < segment.end) {
        segment.manuallyNavigated = true;
        segment.autoSkipped = false; // Reset the auto-skipped flag
        break;
      } else {
        // Reset flags for segments that are not being navigated to
        segment.manuallyNavigated = false;
        segment.autoSkipped = false;
      }
    }
    setSponsorSegments(segments);
  };

  const prevChapter = () => {
    if (!mediaPlayer) return;
    if (!videoQuery.data?.chapters) return;
    const currentTime = mediaPlayer.currentTime;
    let currentChapter: Chapter | undefined;
    for (let i = 0; i < videoQuery.data.chapters.length; i++) {
      const chapter = videoQuery.data.chapters[i];
      if (
        currentTime >= chapter.start &&
        currentTime < videoQuery.data.chapters[i + 1]?.start
      ) {
        currentChapter = chapter;
        break;
      }
    }
    if (!currentChapter) return;
    const prevChapter = videoQuery.data.chapters.slice().reverse().find(
      (c) => c.start < currentChapter!.start - 1
    );
    if (!prevChapter) return;
    mediaPlayer.currentTime = prevChapter.start;
  };

  const nextChapter = () => {
    if (!mediaPlayer) return;
    if (!videoQuery.data?.chapters) return;
    const currentTime = mediaPlayer.currentTime;
    let currentChapter: Chapter | undefined;
    for (let i = 0; i < videoQuery.data.chapters.length; i++) {
      const chapter = videoQuery.data.chapters[i];
      if (
        currentTime >= chapter.start &&
        currentTime < videoQuery.data.chapters[i + 1]?.start
      ) {
        currentChapter = chapter;
        break;
      }
    }
    if (!currentChapter) return;
    const nextChapter = videoQuery.data.chapters.find(
      (c) => c.start > currentChapter!.start
    );
    if (!nextChapter) return;
    mediaPlayer.currentTime = nextChapter.start;
  };
  let mediaProvider: any;
  async function fetchPartial(url: string, start: number, end: number): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=${start}-${end}`
      }
    });

    const data = await response.arrayBuffer();
    return data;
  }
  async function appendSegment(
    sourceBuffer: SourceBuffer,
    url: string,
    start: number,
    end: number
  ): Promise<void> {
    const segment = await fetchPartial(url, start, end);
    return new Promise<void>((resolve, reject) => {
      sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
      sourceBuffer.addEventListener('error', () => reject('Error appending buffer'), { once: true });
      sourceBuffer.appendBuffer(segment);
    });
  }
  async function setupMSE(
    videoElement: HTMLVideoElement,
    videoStream: any,
    audioStream: any
  ): Promise<void> {
    if (
      !window.MediaSource ||
      !MediaSource.isTypeSupported(`video/mp4; codecs="${videoStream.codec}"`) ||
      !MediaSource.isTypeSupported(`audio/mp4; codecs="${audioStream.codec}"`)
    ) {
      throw new Error("Unsupported MIME type or codec");
    }

    const mediaSource = new MediaSource();
    videoElement.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', async () => {
      const videoSourceBuffer = mediaSource.addSourceBuffer(`video/mp4; codecs="${videoStream.codec}"`);
      const audioSourceBuffer = mediaSource.addSourceBuffer(`audio/mp4; codecs="${audioStream.codec}"`);

      // Append init segments
      await Promise.all([
        appendSegment(videoSourceBuffer, videoStream.url, videoStream.initStart, videoStream.initEnd),
        appendSegment(audioSourceBuffer, audioStream.url, audioStream.initStart, audioStream.initEnd)
      ]);

      // Append remaining segments (simplified example)
      let videoNextStart = videoStream.indexStart;
      let audioNextStart = audioStream.indexStart;

      let videoEnd = videoStream.indexEnd;
      let audioEnd = audioStream.indexEnd;

      while (videoNextStart <= videoEnd && audioNextStart <= audioEnd) {
        await Promise.all([
          appendSegment(videoSourceBuffer, videoStream.url, videoNextStart, videoNextStart + 2000), // Fetch 2000 bytes as an example
          appendSegment(audioSourceBuffer, audioStream.url, audioNextStart, audioNextStart + 2000)
        ]);

        videoNextStart += 2001; // 2001 to avoid overlapping byte ranges
        audioNextStart += 2001;
      }

      // End the streams
      if (mediaSource.readyState === 'open') {
        mediaSource.endOfStream();
      }
    });
  }
  let videoElement: any;
  createEffect(() => {
    if (!videoElement){
      console.log("video element not ready");
      return;
    }
    console.log("setting up mse");
    if (!videoQuery.data) return;
    setupMSE(videoElement, videoQuery.data?.videoStreams?.[0], videoQuery.data?.audioStreams?.[0]);
  });



  return (<Suspense fallback={<div>Loading...</div>}>
    <Show when={videoQuery.data}>
      <media-player
        id="player"
        classList={{
          " z-[99999] aspect-video relative bg-slate-900 text-white font-sans overflow-hidden ring-primary data-[focus]:ring-4": true,
          "absolute  inset-0 w-full h-full": !!route.query.fullscreen,
          "sticky md:relative top-0 sm:block ": !route.query.fullscreen,
        }}
        current-time={currentTime()}
        // onTextTrackChange={handleTextTrackChange}
        load="eager"
        key-disabled
        tabIndex={-1}
        playbackRate={preferences.speed}
        muted={preferences.muted}
        volume={preferences.volume}
        on:volume-change={(e) => {
          console.log("volume change", e.detail);
          setPreferences("volume", e.detail.volume);
          setPreferences("muted", e.detail.muted);
        }}
        on:time-update={() => {
          autoSkipHandler();
        }}
        on:can-play={onCanPlay}
        on:provider-change={onProviderChange}
        on:hls-error={handleHlsError}
        on:ended={handleEnded}
        on:play={() => {
          setStarted(true);
          setTimeout(() => {
            updateProgress();
          }, 0);
        }}
        on:seeked={() => {
          updateProgress();
          userNavigationHandler();
        }}
        on:pause={() => {
          updateProgress();
        }}
        on:hls-manifest-loaded={(e: any) => {
          console.log(e.detail, "levels");
        }}
        on:media-player-connect={() => setMediaPlayerConnected(true)}
        autoplay
        ref={mediaPlayer}
        title={videoQuery.data?.title ?? ""}
        // src={videoQuery.data?.hls ?? ""}
        poster={videoQuery.data?.thumbnailUrl ?? ""}
        //       aspect-ratio={videoQuery.data?.videoStreams?.[0]
        //           ? videoQuery.data.videoStreams[0]?.width /
        //             videoQuery.data.videoStreams[0]?.height
        //           :
        // 16 / 9}
        aspect-ratio={16 / 9}
        crossorigin="anonymous"
        on:fullscreen-change={(e) => {
          const urlParams = new URLSearchParams(window.location.search);
          if (e.detail) {
            urlParams.set("fullscreen", "true");
          } else {
            urlParams.delete("fullscreen");
          }
          history.replaceState(
            null,
            "",
            window.location.pathname + "?" + urlParams.toString()
          );
        }}
      >
        <media-provider
          ref={mediaProvider}
        // classList={{"relative min-h-0 max-h-16 pb-0 h-full": preferences.pip}}
        >
          <media-poster
            aria-hidden="true"
            src={videoQuery.data?.thumbnailUrl ?? ""}
            class="absolute inset-0 block h-full w-full rounded-md opacity-0 transition-opacity data-[visible]:opacity-100 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
          ></media-poster>
          {tracks().map((track) => {
            return (
              <track
                id={track.id}
                kind={track.kind as any}
                src={track.src}
                srclang={track.srcLang}
                label={track.label}
                data-type={track.dataType}
              />
            );
          })}
          {/* <media-captions class="transition-[bottom] not-can-control:opacity-100 user-idle:opacity-100 not-user-idle:bottom-[80px]" /> */}
          <Show when={videoQuery.data?.hls}>
            {(() => { console.log("hls", videoQuery.data?.hls); return null; })()}
            <source src={videoQuery.data?.hls} type="application/x-mpegurl" />
          </Show>
        </media-provider>
        <Show
          when={
            errors().length > 0 &&
            showErrorScreen().show &&
            !showErrorScreen().dismissed
          }
        >
          <div
            // classList={{hidden: preferences.pip}}
            class="absolute z-50 top-0 right-0 w-full h-full opacity-100 pointer-events-auto bg-black/50"
          >
            <div class="flex flex-col items-center justify-center w-full h-full gap-3">
              <div class="text-2xl font-bold text-white">
                {errors()[errors().length - 1]?.name}{" "}
                {errors()[errors().length - 1]?.details}
              </div>
              <div class="flex flex-col">
                <div class="text-lg text-white">
                  {errors()[errors().length - 1]?.message}
                </div>
                <div class="text-lg text-white">
                  Please try switching to a different instance or refresh the
                  page.
                </div>
              </div>
              <div class="flex justify-center gap-2">
                <button
                  class="px-4 py-2 text-lg text-white border border-white rounded-md"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setShowErrorScreen({ show: false, dismissed: true });
                    }
                  }}
                  onClick={() => {
                    setShowErrorScreen({ show: false, dismissed: true });
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Show>
        <Show when={showEndScreen() && nextVideo()}>
          <div class="absolute z-50 scale-50 sm:scale-75 md:scale-100 top-0 right-0 w-full h-full pointer-events-auto">
            <div class="flex flex-col items-center justify-center w-full h-full gap-3">
              <div class="text-2xl font-bold text-white">
                Playing next in {counter()} seconds
              </div>
              <div class="flex flex-col">
                <div class="text-lg text-white w-72">
                  <VideoCard v={nextVideo()?.info ?? undefined} />
                </div>
              </div>
              <div class="flex justify-center gap-2">
                <button
                  class="px-4 py-2 text-lg text-black bg-white rounded-md"
                  onClick={() => {
                    dismiss();
                    playNext();
                  }}
                >
                  Play now (Shift + N)
                </button>
                <button
                  class="px-4 py-2 text-lg text-white bg-black rounded-md"
                  onClick={() => {
                    dismiss();
                  }}
                >
                  Dismiss (Esc)
                </button>
              </div>
            </div>
          </div>
        </Show>
        <VideoLayout
          thumbnails={generateStoryboard(videoQuery.data?.previewFrames?.[1]) ?? ""}
          loop={preferences.loop}
          chapters={vtt()}

          onLoopChange={(value) => {
            setPreferences("loop", value);
          }}
          navigateNext={nextVideo()?.url ? playNext : undefined}
          navigatePrev={prevVideo()?.url ? () => navigate(prevVideo()!.url) : undefined}
          playlist={list()}
        />
      </media-player>
    </Show>
  </Suspense>
  );
}
