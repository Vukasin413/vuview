import { JSX } from "solid-js";
import { Button as HeadlessButton } from "solid-headless";
import { classNames } from "~/utils/helpers";

export default function Button(props: {
  class?: string;
  onClick?: (e: any) => void;
  label?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  activated?: boolean;
}) {
  return (
    <HeadlessButton
      onClick={props.onClick}
      disabled={props.disabled}
      // classList={{ "!text-text1 !bg-bg2": props.activated }}
      class={`${classNames(
        props.activated && "!text-text1 !bg-bg2",
      )}
      text-text3 bg-primary hover:bg-accent1 cursor-pointer select-none focus:ring-4 focus:ring-accent1 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 focus:outline-none  ${props.class}`}>
      {props.label} 
    </HeadlessButton>
  );
}
