import { RelatedStream } from "~/types";
import { Menu } from "./Menu";
import { MenuPlacement, TooltipPlacement } from "vidstack";
import { For } from "solid-js";
import { A } from "solid-start";

export const RecommendedVideosMenu = (props: RecommendedVideosMenuProps ) => {
  return (
    <Menu
      placement={props.placement}
      buttonSlot={<media-icon class="h-8 w-8" type="queue-list"
        aria-label="Queue"
      />}
      tooltipPlacement={props.tooltipPlacement}
      tooltipSlot={<span>Playlist</span>}
      title={props.title ?? "Queue"}
    >
        <For each={props.videos}>
          {(video) => (
            <A
              href={video.url}
              role="menuitem"
              tabIndex={-1}

              class="max-w-[calc(var(--media-width)-20px)] ring-primary parent left-0 flex w-full cursor-pointer select-none items-center justify-start rounded-sm p-2.5 bg-black/95 outline-none ring-inset  hover:bg-neutral-800/80 focus-visible:bg-neutral-800/80 focus-visible:ring-[3px] aria-hidden:hidden">
              <img
                class="h-18 w-32 shrink-0 rounded-md bg-bg1 aspect-video"
                src={video.thumbnail}
              />
              <div class="ml-2 flex grow flex-col overflow-hidden whitespace-pre-wrap">
                <div class="text-sm text-text1 truncate">{video.title}</div>
                <div class="text-xs text-text1/50">{video.uploaderName}</div>
              </div>
            </A>
          )}
        </For>
    </Menu>
  );
};

export interface RecommendedVideosMenuProps {
  placement: MenuPlacement;
  tooltipPlacement: TooltipPlacement;
  videos?: RelatedStream[]
  title?: string;
}
