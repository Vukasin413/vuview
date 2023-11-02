import { JSX, Show } from "solid-js";
import { Button as KobalteButton } from "@kobalte/core";
import { Spinner } from "./PlayerContainer";
import { useNavigate } from "solid-start";

export default function Button(props: {
  class?: string;
  onClick?: (e: any) => void;
  label?: string;
  icon?: JSX.Element;
  isSelected?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  appearance?: "primary" | "subtle" | "link" | "danger" | "warning";
  as?: keyof JSX.IntrinsicElements;
  href?: string;
}) {
  const getAppearanceClasses = (appearance?: string) => {
    const map: Record<string, Record<string, boolean>> = {
      "primary": {
        "bg-primary hover:bg-primary/90 shadow hover:shadow-3xl text-text1 border-transparent hover:border-primary/30 active:bg-primary/80": true,
      },
      "subtle": {
        "bg-transparent hover:bg-bg3/80 shadow hover:shadow-3xl text-text1 border-transparent ": true,
      },
      "link": {
        "bg-transparent text-primary border-transparent hover:border-transparent": true,
      },
      "danger": {
        "bg-red-600 hover:bg-red-600/90 shadow hover:shadow-3xl text-text1 border-transparent hover:border-red-600/30": true,
      },
      "warning": {
        "bg-yellow-600 hover:bg-yellow-600/90 shadow hover:shadow-3xl text-text1 border-transparent hover:border-yellow-600/30": true,
      },
    }

    return map[appearance ?? "primary"];
  };
  const navigate = useNavigate();
  return (
    <KobalteButton.Root
      as={props.as ?? "button"}
      onClick={props.onClick ?? (() => {
        if (props.href !== undefined) {
          navigate(props.href);
        }
      })}
      disabled={props.isDisabled}
      classList={{
        "relative focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed duration-200 ease-in-out py-1 px-3 text-sm rounded-full border-4  appearance-none transition-colors cursor-pointer select-none focus:outline-none active:translate-y-[2px]": true,
        "flex items-center justify-center": props.icon !== undefined && props.label !== undefined,
        "!text-text1 !bg-bg2": props.isSelected === true,
        ...getAppearanceClasses(props.appearance),
        [props.class!]: props.class !== undefined,
      }}
    >
      <Show when={props.icon !== undefined}>
        <span
          classList={{
            "invisible": props.isLoading,
          }}>
          {props.icon}
        </span>
      </Show>
      <Show when={props.label !== undefined}>
        <span classList={{
          "ml-2": props.icon !== undefined,
          "invisible": props.isLoading,
        }}>{props.label}</span>
      </Show>
      <Show when={props.isLoading}>
        <LoadingDots
          class="absolute mx-auto my-auto"
        />
      </Show>

    </KobalteButton.Root>
  );
}

export const LoadingDots = (props: { class?: string }) => {
  return (
    <div
      classList={{
        "flex space-x-1": true,
        [props.class!]: props.class !== undefined,
      }}>
      <div class="w-2 h-2 bg-white rounded-full animate-bounce"></div>
      <div class="w-2 h-2 bg-white rounded-full animate-bounce delay-150"></div>
      <div class="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></div>
    </div>
  );
};

