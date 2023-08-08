import type { Chapter, PipedVideo, RelatedStream } from "~/types";
import "vidstack/icons";
import {
  For,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { A } from "solid-start";
import { MediaGestureElement, MediaPlayerElement } from "vidstack";
import { MediaIconElement } from "vidstack/icons";
import { PreferencesContext } from "~/root";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "media-gesture": any;
      "media-mute-button": any;
      "media-icon": MediaIconElement;
      "media-tooltip": any;
      "media-control-group": any;
      "media-control": any;
      "media-slider": any;
      "media-slider-thumb": any;
      "media-slider-track": any;
      "media-slider-fill": any;
      "media-time-slider": any;
      "media-slider-value": any;
      "media-slider-video": any;
      "media-live-indicator": any;
      "media-volume-slider": any;
      "media-play-button": any;
      "media-time": any;
      "media-fullscreen-button": any;
      "media-pip-button": any;
      "media-menu": any;
      "media-menu-items": any;
      "media-menu-button": any;
      "media-captions-menu-items": any;
      "media-chapters-menu-items": any;
      "media-settings-menu-items": any;
      "media-quality-menu-items": any;
      "media-playback-rate-menu-items": any;
      "media-caption-button": any;
      "media-audio-menu-button": any;
      "media-audio-menu-items": any;
      "media-toggle-button": any;
    }
  }
}

interface PlayerSkinProps {
  video: PipedVideo | null | undefined;
  isMiniPlayer: boolean;
}
export default function PlayerSkin({ video, isMiniPlayer }: PlayerSkinProps) {
  const [currentChapter, setCurrentChapter] = createSignal("");
  const [player, setPlayer] = createSignal<MediaPlayerElement | null>();
  const [preferences, setPreferences] = useContext(PreferencesContext);

  let interval: any;
  createEffect(() => {
    if (!video?.chapters) return;
    setPlayer(document.querySelector("media-player"));
    if (!player()) return;
    interval = setInterval(() => {
      const currentTime = player()!.state.currentTime;
      const chapter = video.chapters.find((chapter, index) => {
        if (
          chapter.start <= currentTime &&
          currentTime <= video.chapters[index + 1]?.start
        ) {
          return true;
        }
      });
      if (chapter) {
        setCurrentChapter(chapter.title);
      }
    }, 1000);
  });

  onCleanup(() => {
    clearInterval(interval);
  });

  const [currentAction, setCurrentAction] = createSignal({
    name: "",
    value: "",
  });

  return (
    <div
      tabIndex={0}
      class="pointer-events-none absolute inset-0 z-10 h-full "
      role="group"
      aria-label="Media Controls">
      <div class="absolute top-0 left-0 z-0 pointer-events-auto w-full h-full">
        <CenterGesture
          onDblClick={() => {
            if (!player()) return;
            player()!.paused = !player()!.paused;
            setCurrentAction({
              name: player()!.paused ? "play" : "pause",
              value: "",
            });
          }}
          onPointerDown={() => {
            if (!player()) return;
            // console.log(player()!.user.idling, "idling");
            // player()!.user.idle(!player()!.user.idling, 5000);
          }}
        />
        <BufferingIndicator />
        <LeftGesture
          onDblClick={() => {
            if (!player()) return;
            if (Math.floor(player()!.currentTime) === 0) return;
            player()!.currentTime -= 10;
            setCurrentAction({ name: "seek-", value: "-10" });
          }}
        />
        <RightGesture
          playerHeight={
            parseInt(
              player()?.style.getPropertyValue("--media-height") ?? ""
            ) || 0
          }
          volume={player()?.volume || 0}
          setVolume={(v: number) => {
            if (!player()) return;
            player()!.volume = v;
            setCurrentAction({
              name: "volume",
              value: Math.floor(v * 100).toString() + "%",
            });
          }}
          onDblClick={() => {
            if (!player() || !video) return;
            if (player()!.currentTime + 1 > video.duration) return;
            player()!.currentTime += 10;
            setCurrentAction({ name: "seek+", value: "10" });
          }}
        />
        <ActionDisplay action={currentAction()} />
      </div>

      <div class="pointer-events-none absolute inset-0 z-10 flex h-full flex-col justify-between text-text1 opacity-0 transition-opacity duration-200 ease-linear not-can-play:opacity-100 can-control:opacity-100">

        <div class="pointer-events-none absolute inset-0 z-0 h-full w-full bg-gradient-to-t from-black/50 from-5% via-transparent via-50% to-black/20 to-100%" />

        {/* Top Controls */}
        <MediaControlGroup>
          <div class="z-10 flex w-24 justify-between rounded-full bg-black/30 items-center truncate font-sans text-lg font-normal text-white not-can-play:opacity-0">
            <button
              role="button"
              aria-label="Previous Video"
              disabled
              class="h-10 w-10 disabled:text-white/50">
              <media-icon type="chevron-left" />
            </button>
            <div class="w-px h-8 bg-white/50" />
            <button
              role="button"
              aria-label="Next Video"
              class="h-10 w-10 disabled:text-white/50">
              <media-icon type="chevron-right" />
            </button>
          </div>
          <div class="flex w-max items-center justify-end">
            <media-mute-button class="group peer flex h-10 w-10 items-center justify-center rounded-sm text-white outline-none sm:hidden">
              <media-icon
                type="mute"
                class="hidden group-data-[volume=muted]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-icon
                type="volume-low"
                class="hidden group-data-[volume=low]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-icon
                type="volume-high"
                class="hidden group-data-[volume=high]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-tooltip position="bottom center" class="">
                <span class="hidden not-muted:inline">Mute</span>
                <span class="hidden muted:inline">Unmute</span>
              </media-tooltip>
            </media-mute-button>
            <ChaptersMenu chapters={video?.chapters} />
            <SettingsMenu />
          </div>
        </MediaControlGroup>

        {/* Centre Controls */}
        <div class="flex min-h-[48px] w-full p-2 items-center justify-center">
          <media-play-button
            aria-keyshortcuts="k Space"
            class="group pointer-events-auto buffering:opacity-0 duration-500 text-white rounded-full bg-black/30 outline-none flex sm:hidden justify-center items-center transition-all relative h-20 w-20"
            aria-label="Play">
            <media-icon
              type="play"
              class="hidden ring-0 paused:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary  "
            />
            <media-icon
              type="pause"
              class="hidden ring-0 not-paused:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
            />
          </media-play-button>
        </div>

        {/* Bottom Controls */}
        <div class="pointer-events-none z-10 flex w-full max-w-full shrink flex-col px-2 pb-2 can-control:pointer-events-auto not-can-play:opacity-0 transition-all">

          <div class="flex items-center">
            <media-live-indicator class="flex group h-4 w-10 rounded-sm py-px px-1 tracking-widest text-sm uppercase items-center justify-center text-white not-live:hidden bg-gray-400 live-edge:bg-red-500 live-edge:text-white">
                live
            </media-live-indicator>
            <media-time-slider
              class="group peer flex h-8 w-full z-10 items-center"
              track-class="group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              track-fill-class="z-20 bg-primary "
              track-progress-class="z-10"
              thumb-container-class="z-20"
              thumb-class="bg-primary"
              chapters-class=""
              chapter-container-class=""
              chapter-class="">
              <div slot="preview">
                <media-slider-value
                  type="pointer"
                  format="time"
                  class="z-50 rounded-t bg-bg1/80"
                />
                <div class="bg-bg1/80 rounded-t px-2">
                  <span part="chapter-title" />
                </div>
                <media-slider-video
                  src={video?.videoStreams.find((s) => s.bitrate < 400000)?.url}
                  onError={console.error}
                />
              </div>
            </media-time-slider>
          </div>

          <div class="flex items-center px-2 w-full z-10">
            <media-play-button
              aria-keyshortcuts="k Space"
              class="group hidden sm:inline-flex"
              aria-label="Play">
              <media-icon
                type="play"
                class="hidden paused:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary  "
              />
              <media-icon
                type="pause"
                class="hidden not-paused:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              {/* <media-icon
                  type="replay"
                  class="hidden ring-0 ended:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
                /> */}
              <media-tooltip>
                <span class="hidden paused:inline">Play (k)</span>
                <span class="hidden not-paused:inline">Pause (k)</span>
              </media-tooltip>
            </media-play-button>
            <media-mute-button
              aria-keyshortcuts="m"
              class="group peer hidden sm:flex">
              <media-icon
                type="mute"
                class="hidden group-data-[volume=muted]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-icon
                type="volume-low"
                class="hidden group-data-[volume=low]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-icon
                type="volume-high"
                class="hidden group-data-[volume=high]:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
              />
              <media-tooltip>
                <span class="hidden not-muted:inline">Mute (m)</span>
                <span class="hidden muted:inline">Unmute (m)</span>
              </media-tooltip>
            </media-mute-button>
            <media-volume-slider
              aria-keyshortcuts="ArrowUp ArrowDown"
              key-step="5"
              shift-key-multiplier="2"
              class="group hidden sm:inline-block transition-all duration-200 max-w-0 data-[hocus]:max-w-[5rem] peer-data-[hocus]:max-w-[5rem] "
              track-class="absolute top-1/2 left-0 block h-1 w-20 hidden bg-[#5a595a] outline-none group-data-[hocus]:block group-data-[hocus]:ring-4 group-data-[hocus]:ring-primary"
              track-fill-class="absolute top-1/2 left-0 z-20 h-1 w-[var(--slider-fill-percent)] -translate-y-1/2 bg-white will-change-[width]"
              thumb-container-class="absolute top-0 left-[var(--slider-fill-percent)] z-20 h-full w-5 -translate-x-1/2 group-data-[dragging]:left-[var(--slider-pointer-percent)]"
              thumb-class="absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity duration-150 ease-in group-data-[interactive]:opacity-100">
              <div class="left-[var(--preview-left)] " slot="preview">
                <media-slider-value type="pointer" format="percent" />
              </div>
            </media-volume-slider>
            <div class="flex items-center">
              <media-time
                type="current"
                class="items-center px-1 text-sm text-white"
              />
              /
              <media-time
                type="duration"
                class="items-center px-1 text-sm text-white"
              />
            </div>

            <div class="inline-flex flex-1 truncate items-center">
              <div
                class="text-white z-10"
                classList={{ hidden: !currentChapter() }}>
                •{" "}
                <span
                  part="chapter-title"
                  class="z-10 truncate pl-1 font-sans text-sm font-normal text-white ">
                  {currentChapter() ?? video?.title}
                </span>
              </div>
            </div>
            <media-caption-button
              aria-keyshortcuts="c"
              aria-label="Captions"
              class="group z-10 inline-flex h-10 w-10 items-center justify-center rounded-sm text-white outline-none ">
              <media-icon
                class="not-captions:block hidden group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
                type="closed-captions"></media-icon>
              <media-icon
                class="captions:block hidden group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
                type="closed-captions-on"></media-icon>
              <media-tooltip position="top center">
                <span slot="on">Closed-Captions On</span>
                <span slot="off">Closed-Captions Off</span>
              </media-tooltip>
            </media-caption-button>
            <RecommendedVideosMenu videos={video?.relatedStreams} />
            <media-toggle-button
              onClick={() =>
                setPreferences({ theatreMode: !preferences.theatreMode })
              }
              aria-keyshortcuts="t"
              aria-label="Theatre Mode"
              class="group z-10 hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-sm text-white outline-none ">
              <media-icon
                classList={{
                  hidden: !preferences.theatreMode,
                  block: preferences.theatreMode,
                }}
                class="group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
                type="theatre-mode"></media-icon>
              <media-icon
                classList={{
                  hidden: preferences.theatreMode,
                  block: !preferences.theatreMode,
                }}
                class="group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
                type="theatre-mode-exit"></media-icon>
              <media-tooltip position="top center">
                <span slot="on">Theatre Mode On</span>
                <span slot="off">Theatre Mode Off</span>
              </media-tooltip>
            </media-toggle-button>
            <FullscreenButton />
          </div>
        </div>
      </div>
    </div>
  );
}

const ActionDisplay = (props: { action: { name: string; value: string } }) => {
  const [name, setName] = createSignal("");
  const [value, setValue] = createSignal("");
  let timeout: any;
  let acc = 0;
  createEffect(() => {
    let v = () => {
      if (props.action.name === "seek+") {
        acc += parseInt(props.action.value);
        return `${acc}s`;
      } else if (props.action.name === "seek-") {
        console.log(props.action.value, parseInt(props.action.value));
        acc -= parseInt(props.action.value);
        return `-${acc}s`;
      } else return props.action.value;
    };
    clearTimeout(timeout);
    setName(props.action.name);
    setValue(v());
    timeout = setTimeout(() => {
      setName("");
      setValue("");
      acc = 0;
    }, 750);
  });
  onCleanup(() => {
    clearTimeout(timeout);
  });

  return (
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        classList={{
          "opacity-0 scale-0": name() == "",
          "opacity-100 scale-100": !!name(),
        }}
        class="flex items-center flex-col justify-center transition-all duration-200 ease-in-out w-32 h-32 bg-black rounded-full bg-opacity-50">
        <div class="w-16 h-16 font-bold text-white">
          <media-icon
            class="absolute w-16 h-16"
            type="mute"
            classList={{
              "opacity-0": !(name() === "volume" && parseInt(value()) === 0),
            }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="volume-low"
            classList={{
              "opacity-0": !(
                name() === "volume" &&
                parseInt(value()) < 50 &&
                parseInt(value()) > 0
              ),
            }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="volume-high"
            classList={{
              "opacity-0": !(name() === "volume" && parseInt(value()) >= 50),
            }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="fast-forward"
            classList={{ "opacity-0": name() !== "seek+" }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="fast-backward"
            classList={{ "opacity-0": name() !== "seek-" }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="play"
            classList={{ "opacity-0": name() !== "play" }}></media-icon>
          <media-icon
            class="absolute w-16 h-16"
            type="pause"
            classList={{ "opacity-0": name() !== "pause" }}></media-icon>
        </div>

        <div class="text-2xl font-bold text-white">{value()}</div>
      </div>
    </div>
  );
};

const LeftGesture = (props: { onDblClick: (e: MouseEvent) => void }) => {
  return (
    <div
      class="left-0 z-0 absolute top-0 h-full w-1/5"
      onDblClick={props.onDblClick}
    />
  );
};

const RightGesture = (props: {
  onDblClick: (e: MouseEvent) => void;
  volume: number;
  setVolume: (v: number) => void;
  playerHeight: number;
}) => {
  let startY = 0;
  let startVolume = 0;

  return (
    <div
      class="right-0 z-0 absolute top-0 h-full w-1/5"
      onDblClick={props.onDblClick}
      onTouchStart={(e) => {
        console.log("touch start");
        if (e.touches.length == 1) {
          startY = e.touches[0].clientY;
          startVolume = props.volume;
        }
      }}
      onTouchMove={(e) => {
        console.log(props.playerHeight);
        if (e.touches.length == 1) {
          const deltaY = startY - e.touches[0].clientY;
          let newVolume = startVolume + deltaY / props.playerHeight;
          newVolume = Math.min(Math.max(newVolume, 0), 1);
          props.setVolume(newVolume);
        }
      }}
      onPointerUp={(e) => {}}
    />
  );
};
const CenterGesture = (props: {
  onDblClick: (e: MouseEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
}) => {
  return (
    <div
      class="z-0 absolute top-0 h-full w-full"
      onDblClick={props.onDblClick}
      onPointerDown={props.onPointerDown}
    />
  );
};

const FullscreenButton = () => {
  return (
    <media-fullscreen-button
      aria-keyshortcuts="f"
      aria-label="Fullscreen"
      class="group flex z-10 h-10 w-10 items-center justify-center rounded-sm text-white outline-none ">
      <media-icon
        type="fullscreen"
        class="hidden ring-0 not-fullscreen:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
      />
      <media-icon
        type="fullscreen-exit"
        class="hidden ring-0 fullscreen:block group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
      />
      <media-tooltip class="tooltip" style={{ transformOrigin: "50% 100%" }}>
        <span class="hidden not-fullscreen:inline">Enter Fullscreen</span>
        <span class="hidden fullscreen:inline">Exit Fullscreen</span>
      </media-tooltip>
    </media-fullscreen-button>
  );
};

const MediaControlGroup = ({ children }: { children: any }) => {
  return (
    <div class="pointer-events-none z-10 flex min-h-[48px] w-full items-center justify-between p-2 can-control:pointer-events-auto">
      {children}
    </div>
  );
};

function SettingsMenu() {
  return (
    <media-menu position="bottom right" class="relative inline-block">
      <media-menu-button
        class="group flex z-10 h-10 w-10 items-center justify-center rounded-sm outline-none"
        aria-label="Settings">
        <media-tooltip
          position="bottom center"
          class="tooltip"
          style={{ transformOrigin: "100% 50%" }}>
          <span class="">Settings</span>
        </media-tooltip>
        <media-icon
          type="settings"
          class="h-8 w-8 rounded-sm transition-transform duration-200 ease-out group-aria-expanded:rotate-90 group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
        />
      </media-menu-button>
      <media-menu-items class=" bg-bg1/95 shadow-sm backdrop-blur-sm transition-all duration-200 ease-in aria-hidden:pointer-events-none aria-hidden:bottom-0 aria-hidden:opacity-0 data-[thumbnails]:min-w-[300px]  ">
        <CaptionsMenu />
        <QualityMenu />
        <PlaybackRateMenu />
        <AudioMenu />
      </media-menu-items>
    </media-menu>
  );
}
function AudioMenu() {
  return (
    <media-menu>
      <media-audio-menu-button label="Audio"></media-audio-menu-button>
      <media-audio-menu-items empty-label="Default"></media-audio-menu-items>
    </media-menu>
  );
}
function ChaptersMenu({ chapters }: { chapters?: Chapter[] | null }) {
  if (!chapters || chapters.length === 0) return <></>;
  return (
    <media-menu position="bottom right" class="relative inline-block">
      {/* Menu Button */}
      <media-menu-button
        class="group z-10 flex h-10 w-10 items-center justify-center rounded-sm outline-none"
        aria-label="Chapters">
        <media-icon
          type="chapters"
          class="h-8 w-8 rounded-sm transition-transform duration-200 ease-out group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
        />
        <media-tooltip
          position="bottom center"
          class=""
          style={{ transformOrigin: "50% 100%" }}>
          <span class="inline">Chapters</span>
        </media-tooltip>
      </media-menu-button>
      {/* Menu Items */}
      <media-chapters-menu-items
        class=" bg-bg1/95 shadow-sm backdrop-blur-sm transition-all duration-200 ease-in aria-hidden:pointer-events-none aria-hidden:bottom-0 aria-hidden:opacity-0 data-[thumbnails]:min-w-[300px]  "
        container-class="w-full"
        chapter-class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:m-1 data-[focus]:ring-primary border-b border-b-white/20 last:border-b-0 aria-checked:border-l-4 aria-checked:border-l-white"
        thumbnail-class="mr-3 min-w-[120px] min-h-[56px] max-w-[120px] max-h-[68px]"
        title-class="text-white text-[15px] font-medium whitespace-nowrap"
        start-time-class="inline-block py-px px-1 rounded-sm text-white text-xs font-medium bg-bg2 mt-1.5"
        duration-class="text-xs text-white/50 font-medium rounded-sm mt-1.5"
      />
    </media-menu>
  );
}

const CaptionsMenu = () => {
  return (
    <media-menu class="text-sm text-white">
      <CaptionsMenuButton />
      <media-captions-menu-items
        class="relative flex flex-col p-1 aria-hidden:hidden"
        radio-group-class="w-full"
        radio-class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary"
        radio-check-class="rounded-full border-1 flex items-center justify-center w-2.5 h-2.5 mr-2 border-bg2 group-aria-checked:border-primary after:content-[''] after:border-2 after:border-primary after:hidden group-aria-checked:after:inline-block after:rounded-full after:w-1 after:h-1"
      />
    </media-menu>
  );
};

const CaptionsMenuButton = () => {
  return (
    <media-menu-button class="group z-10 flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary">
      <media-icon
        type="arrow-left"
        class="hidden h-4 w-4 group-aria-expanded:inline"
      />
      <media-icon
        type="closed-captions"
        class="h-6 w-6 group-aria-expanded:hidden"
      />
      <span class="ml-1.5">Captions</span>
      <span class="ml-auto text-white/50" slot="hint"></span>
      <media-icon
        type="chevron-right"
        class="ml-0.5 h-4 w-4 text-white/50 group-aria-disabled:opacity-0 group-aria-expanded:hidden"
      />
    </media-menu-button>
  );
};
const QualityMenu = () => {
  return (
    <media-menu class="text-sm text-white">
      <QualityMenuButton />
      <media-quality-menu-items
        class="relative flex flex-col p-1 aria-hidden:hidden"
        radio-group-class="w-full"
        radio-class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary"
        radio-check-class="rounded-full border-1 flex items-center justify-center w-2.5 h-2.5 mr-2 border-gray-500 group-aria-checked:border-primary after:content-[''] after:border-2 after:border-primary after:hidden group-aria-checked:after:inline-block after:rounded-full after:w-1 after:h-1"
      />
    </media-menu>
  );
};

const QualityMenuButton = () => {
  return (
    <media-menu-button class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary">
      <media-icon
        type="arrow-left"
        class="hidden h-4 w-4 group-aria-expanded:inline"
      />
      <media-icon type="settings" class="h-6 w-6 group-aria-expanded:hidden" />
      <span class="ml-1.5">Quality</span>
      <span class="ml-auto text-white/50" slot="hint"></span>
      <media-icon
        type="chevron-right"
        class="ml-0.5 h-4 w-4 text-white/50 group-aria-disabled:opacity-0 group-aria-expanded:hidden"
      />
    </media-menu-button>
  );
};

const PlaybackRateMenu = () => {
  return (
    <media-menu class="text-sm text-white">
      <PlaybackRateMenuButton />
      <media-playback-rate-menu-items
        class="relative flex flex-col p-1 aria-hidden:hidden"
        radio-group-class="w-full"
        radio-class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary"
        radio-check-class="rounded-full border-1 flex items-center justify-center w-2.5 h-2.5 mr-2 border-gray-500 group-aria-checked:border-primary after:content-[''] after:border-2 after:border-primary after:hidden group-aria-checked:after:inline-block after:rounded-full after:w-1 after:h-1"
      />
    </media-menu>
  );
};

const PlaybackRateMenuButton = () => {
  return (
    <media-menu-button class="group flex cursor-pointer items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary">
      <media-icon
        type="arrow-left"
        class="hidden h-4 w-4 group-aria-expanded:inline"
      />
      <media-icon type="odometer" class="h-6 w-6 group-aria-expanded:hidden" />
      <span class="ml-1.5">Speed</span>
      <span class="ml-auto text-white/50" slot="hint"></span>
      <media-icon
        type="chevron-right"
        class="ml-0.5 h-4 w-4 text-white/50 group-aria-disabled:opacity-0 group-aria-expanded:hidden"
      />
    </media-menu-button>
  );
};

const RecommendedVideosMenu = ({ videos }: { videos?: RelatedStream[] }) => {
  return (
    <media-menu class="relative hidden fullscreen:inline-block ">
      <RecommendedVideosMenuButton />
      <media-menu-items class="absolute bottom-full right-0 h-[var(--menu-height)] max-h-96 min-w-[260px] overflow-y-auto rounded-lg bg-bg1/95 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200 ease-in aria-hidden:pointer-events-none aria-hidden:bottom-0 aria-hidden:opacity-0 data-[resizing]:overflow-hidden">
        <For each={videos}>
          {(video) => (
            <A
              role="menuitem"
              tabIndex={-1}
              href={video.url}
              class="flex items-center p-2.5 data-[hocus]:bg-white/10 data-[focus]:ring-2 data-[focus]:ring-primary">
              <div
                class="h-9 w-16 shrink-0 rounded-md bg-bg1"
                style={{ "background-image": `url(${video.thumbnail})` }}
              />
              <div class="ml-2 flex grow flex-col">
                <div class="text-sm text-white">{video.title}</div>
                <div class="text-xs text-white/50">{video.uploaderName}</div>
              </div>
            </A>
          )}
        </For>
      </media-menu-items>
    </media-menu>
  );
};
function RecommendedVideosMenuButton() {
  return (
    <media-menu-button
      class="group z-10 flex h-10 w-10 items-center justify-center rounded-sm outline-none"
      aria-label="Recommended Videos">
      <media-icon
        type="playlist"
        class="h-8 w-8 rounded-sm group-data-[focus]:ring-4 group-data-[focus]:ring-primary"
      />
    </media-menu-button>
  );
}

const BufferingIndicator = () => {
  return (
    <div class="pointer-events-none absolute inset-0 z-50 flex h-full w-full items-center justify-center">
      <svg
        class="h-24 w-24 text-white opacity-0 transition-opacity duration-200 ease-linear buffering:animate-spin buffering:opacity-100"
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
            "stroke-dasharray": 100,
            "stroke-dashoffset": "50",
          }}
        />
      </svg>
    </div>
  );
};
