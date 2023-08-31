import { useLocation, useNavigate } from "solid-start";
import Player from "./Player";
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createRenderEffect,
  createSignal,
  on,
  useContext,
} from "solid-js";
import { PlayerContext, PreferencesContext } from "~/root";
import VideoCard from "./VideoCard";

export default function PlayerContainer() {
  const route = useLocation();
  const [video] = useContext(PlayerContext);
  const [preferences] = useContext(PreferencesContext);

  const Loading = () =>
    route.pathname === "/watch" ? <LoadingState /> : <></>;
  const Error = (props: any) =>
    route.pathname === "/watch" ? (
      <ErrorState message={props.message} name={props.name} />
    ) : (
      <></>
    );

  const [theatre, setTheatre] = createSignal(true);

  return (
    <div
      class="flex md:relative md:top-0"
      classList={{
        "fixed md:fixed bottom-0": route.pathname !== "/watch",
        // "lg:max-w-[calc(100%-20.8rem)]": !theatre(),

        // "max-h-[calc(100vh-4rem)]": preferences.theatreMode,
      }}>
      <Switch fallback={<Loading />}>
        <Match when={video.error} keyed>
          <Error message={video.error!.message} name={video.error!.name} />
        </Match>
        <Match when={video.value} keyed>
          {(video) => {
            return <Player />;
          }}
        </Match>
      </Switch>
      <div
        id="column"
        classList={{
          "w-0 h-0": !preferences.theatreMode,
          "w-max min-w-max h-max overflow-y-auto": preferences.theatreMode,
        }}
      />
      {/* <div
        classList={{
          "hidden lg:flex": !preferences.theatreMode,
          hidden: preferences.theatreMode,
        }}
        class="w-[28rem] relative h-1 self-start justify-start">
        <div class="absolute top-0 flex w-full justify-start items-center flex-col h-full">
          <Show
            when={video.value}
            keyed
            fallback={
              <For each={Array(20).fill(0)}>{() => <VideoCard />}</For>
            }>
            {(video) => (
              <For each={video.relatedStreams}>
                {(stream) => {
                  return <VideoCard v={stream} />;
                }}
              </For>
            )}
          </Show>
        </div>
      </div> */}
    </div>
  );
}

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
  return (
    <div class="pointer-events-none aspect-video bg-black flex h-full w-full max-w-full items-center justify-center">
      <Spinner />
    </div>
  );
};

function ErrorState(error: Error) {
  return (
    <div class="pointer-events-none flex-col text-center gap-2 col-span-3 aspect-video bg-black  flex h-full w-full items-center justify-center">
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
  );
}
