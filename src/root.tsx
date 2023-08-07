// @refresh reload
import {
  Match,
  Show,
  Signal,
  Suspense,
  Switch,
  createContext,
  createEffect,
  createRenderEffect,
  createSignal,
  onMount,
  useContext,
} from "solid-js";
import {
  useLocation,
  A,
  Body,
  ErrorBoundary,
  FileRoutes,
  Head,
  Html,
  Meta,
  Routes,
  Scripts,
  Title,
  APIEvent,
  useIsRouting,
  useServerContext,
  parseCookie,
  Link,
  useNavigate,
} from "solid-start";
import "./root.css";
import { isServer } from "solid-js/web";
import Select from "./components/Select";
import Player from "./components/Player";
import { SetStoreFunction, createStore } from "solid-js/store";
import { PipedVideo } from "./types";
import { defineCustomElements } from "vidstack/elements";
import { IDBPDatabase, openDB } from "idb";
import Header from "./components/Header";
import PlayerSkin from "./components/PlayerSkin";
import { MediaOutletElement, MediaPlayerElement } from "vidstack";
import { videoId } from "./routes/history";

const theme = createSignal("monokai");
export const ThemeContext = createContext(theme);

const video = createStore<{
  value: PipedVideo | undefined;
  error: Error | undefined;
}>({
  value: undefined,
  error: undefined,
});
export const PlayerContext = createContext<
  [
    get: {
      value: PipedVideo | undefined;
      error: Error | undefined;
    },
    set: SetStoreFunction<{
      value: PipedVideo | undefined;
      error: Error | undefined;
    }>
  ]
>(video);

const db = createSignal<IDBPDatabase<unknown> | undefined>(undefined);
export const DBContext =
  createContext<Signal<IDBPDatabase<unknown> | undefined>>(db);

const instance = createSignal("https://pipedapi.kavin.rocks");
export const InstanceContext = createContext(instance);

defineCustomElements();

export default function Root() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname
      ? "border-sky-600"
      : "border-transparent hover:border-sky-600";
  const isRouting = useIsRouting();
  const event = useServerContext();
  createRenderEffect(() => {
    const cookie = () => {
      return parseCookie(
        isServer ? event.request.headers.get("cookie") ?? "" : document.cookie
      );
    };
    const t = cookie().theme ?? "monokai";
    const i = cookie().instance ?? "https://pipedapi.kavin.rocks";
    theme[1](t);
    instance[1](i);
  });
  createEffect(async () => {
    console.log(
      new Date().toISOString().split("T")[1],
      "visible task waiting for db"
    );
    console.time("db");
    const odb = await openDB("conduit", 1, {
      upgrade(db) {
        db.createObjectStore("watch_history");
      },
    });
    console.log("setting db visible");
    db[1](odb);
    console.timeEnd("db");
  });
  const [progress, setProgress] = createSignal(0);
  createEffect(() => {
    console.log(isRouting(), "isRouting");
    setProgress(0);
    if (isRouting()) {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90));
      }, 100);
      return () => clearInterval(interval);
    }
  });

  return (
    <Html lang="en">
      <Head>
        <Title>SolidStart - With TailwindCSS</Title>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />

        <Link rel="manifest" href="manifest.json" />
      </Head>
      <ThemeContext.Provider value={theme}>
        <DBContext.Provider value={db}>
          <InstanceContext.Provider value={instance}>
            <PlayerContext.Provider value={video}>
              <Body
                class={`${theme[0]()} bg-bg1 font-poppins scrollbar text-text1 selection:bg-accent2 selection:text-text3 mx-2`}>
                <Suspense>
                  <ErrorBoundary>
                    <Show when={isRouting()}>
                      <div class="fixed h-1 w-full top-0 z-50">
                        <div class={`h-1 bg-primary w-[${progress()}%]`} />
                      </div>
                    </Show>
                    <Header />
                    <Switch fallback={<LoadingState />}>
                      <Match when={video[0].error} keyed>
                        <ErrorState
                          message={video[0].error!.message}
                          name={video[0].error!.name}
                        />
                      </Match>
                      <Match when={video[0].value} keyed>
                        {(video) => {
                          console.log("video changed", video.title);
                          return <Player />;
                        }}
                      </Match>
                    </Switch>
                    <PipContainer />
                    <Routes>
                      <FileRoutes />
                    </Routes>
                  </ErrorBoundary>
                </Suspense>
                <Scripts />
              </Body>
            </PlayerContext.Provider>
          </InstanceContext.Provider>
        </DBContext.Provider>
      </ThemeContext.Provider>
    </Html>
  );
}
const PipContainer = () => {
  const [userIdle, setUserIdle] = createSignal(true);
  const [playing, setPlaying] = createSignal(false);
  const [outlet, setOutlet] = createSignal<MediaOutletElement | null>();
  const [player, setPlayer] = createSignal<MediaPlayerElement | null>();
  const [muted, setMuted] = createSignal(false);
  let timeout: any;
  const handlePointerEvent = () => {
    clearTimeout(timeout);
    setUserIdle(false);
    timeout = setTimeout(() => {
      setUserIdle(true);
    }, 2000);
  };
  let pipContainer: HTMLDivElement | undefined = undefined;

  createEffect(() => {
    if (!video[0].value) return;
    console.log("setting player and outlet", videoId(video[0].value));
    setPlayer(document.querySelector("media-player"));
    setOutlet(document.querySelector("media-outlet"));
    if (player()) {
      player()!.addEventListener("play", () => {
        console.log("playing");
        setPlaying(true);
      });
      player()!.addEventListener("pause", () => {
        setPlaying(false);
      });
      player()!.addEventListener("volumechange", () => {
        setMuted(player()!.muted);
      });
    }
  });
  const hideContainer = () => {
    pipContainer?.classList.add("hidden");
  };
  const navigate = useNavigate();

  return (
    <div
      ref={pipContainer}
      id="pip-container"
      style={{
        "aspect-ratio": video[0].value
          ? video[0].value.videoStreams[0].width /
            video[0].value.videoStreams[0].height
          : "16/9",
      }}
      class="w-full sm:w-96 z-[999] hidden justify-center items-center aspect-video sticky top-2 inset-x-0 sm:left-2 rounded-lg overflow-hidden bg-black">
      <div
        onPointerDown={handlePointerEvent}
        onPointerUp={handlePointerEvent}
        onMouseOver={handlePointerEvent}
        onMouseMove={handlePointerEvent}
        onFocusIn={handlePointerEvent}
        classList={{ "opacity-0": userIdle() }}
        class="absolute bg-black/50 flex flex-col items-center justify-between inset-0 w-full h-full p-2 z-[9999] transition-opacity duration-200">
        <div class="flex items-center justify-between w-full">
          <button
            onClick={() => {
              if (player() && outlet()) {
                player()!.prepend(outlet()!);
                player()!.pause();
                hideContainer();
              } else {
                console.log("no player or outlet");
              }
            }}
            class="bg-white z-10 text-black rounded-full p-2 hover:bg-gray-200">
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              if (player() && outlet()) {
                player()!.prepend(outlet()!);
                hideContainer();
                const id = videoId(video[0].value);
                if (!id) {
                  console.log("no id", id);
                  return;
                }
                navigate(`/watch?v=${id}`);
              } else {
                console.log("no player or outlet");
              }
            }}
            class="bg-white z-10 text-black rounded-full p-2 hover:bg-gray-200">
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
        <div class="absolute inset-0 flex justify-center items-center">
          <button
            class="m-auto"
            onClick={() => {
              console.log("play", player());
              if (player()) {
                if (playing()) {
                  player()!.pause();
                } else {
                  player()!.play();
                }
              }
            }}>
            {/* big play button */}
            <svg
              class="h-12 w-12"
              classList={{ hidden: playing() }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5v14l11-7z"
              />
            </svg>
            {/* pause button */}
            <svg
              class="h-12 w-12"
              classList={{ hidden: !playing() }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 4h3v16H6zM15 4h3v16h-3z"
              />
            </svg>
          </button>
        </div>
        <div class="flex items-center justify-between w-full">
          <button
            onClick={() => {
              if (player()) {
                player()!.muted = !player()!.muted;
              }
            }}
            class="bg-white w-10 h-10 z-10 text-black rounded-full p-2 hover:bg-gray-200">
            <media-icon type="volume-high" classList={{ hidden: muted() }} />
            <media-icon type="volume-muted" classList={{ hidden: !muted() }} />
          </button>
          {/* <button
            onClick={() => {
              if (player()) {
                player()!.requestFullscreen();
              }
            }}
            class="bg-white z-10 text-black rounded-full p-2 hover:bg-gray-200">
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                classList={{ hidden: document.fullscreenElement }}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 11l3-3 3 3m-3 3v6m0 0H6m0 0h12M6 5h12m-6 6V5m0 0H6m0 0h12"
              />
              <path
                classList={{ hidden: !document.fullscreenElement }}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 7H7v6h6V7z"
              />
            </svg>
          </button> */}
        </div>
      </div>
    </div>
  );
};

export const Spinner = () => (
  <svg
    class="h-24 w-24 text-white  transition-opacity duration-200 ease-linear animate-spin"
    fill="none"
    viewBox="0 0 120 120"
    aria-hidden="true">
    <circle
      class="opacity-25"
      cx="60"
      cy="60"
      r="54"
      stroke="currentColor"
      stroke-width="8"
    />
    <circle
      class="opacity-75"
      cx="60"
      cy="60"
      r="54"
      stroke="currentColor"
      stroke-width="10"
      pathLength="100"
      style={{
        "stroke-dasharray": 50,
        "stroke-dashoffset": "50",
      }}
    />
  </svg>
);

const LoadingState = () => {
  const route = useLocation();
  console.log("loading state", route);
  if (route.pathname !== "/watch") return null;
  return (
    <div class="flex">
      <div class="pointer-events-none col-span-3 md:max-w-[calc(100vw-20rem)] aspect-video bg-black  flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    </div>
  );
};

function ErrorState(error: Error) {
  const route = useLocation();
  console.log("loading state", route);
  if (route.pathname !== "/watch") return null;
  return (
    <div class="grid grid-cols-1 md:grid-cols-4">
      <div class="pointer-events-none flex-col text-center gap-2 col-span-3 md:max-w-[calc(100vw-20rem)] aspect-video bg-black  flex h-full w-full items-center justify-center">
        <div class="text-lg sm:text-2xl font-bold text-red-300">
          {error.name} :(
        </div>
        <div class="flex flex-col">
          <div class="text-sm sm:text-lg text-white">{error.message}</div>
          <div class="text-sm sm:text-lg text-white">
            Please try switching to a different instance or refresh the page.
          </div>
        </div>
        {/* <div class="flex justify-center gap-2">
          <button
            class="px-4 py-2 text-lg text-white border border-white rounded-md"
            onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div> */}
      </div>
    </div>
  );
}
