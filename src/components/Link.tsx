import { createEffect, createSignal } from "solid-js";
import { A, useSearchParams } from "solid-start";

export default function Link(props: LinkProps) {

  const [searchParams] = useSearchParams();
  const [href, setHref] = createSignal(props.href);
  createEffect(() => {
  const fullscreen = searchParams.fullscreen === "true";
  const hrefUrl = new URL(`${window.location.origin}${props.href}`);
    if (fullscreen) {
      hrefUrl.searchParams.set("fullscreen", "true");
    } else {
      hrefUrl.searchParams.delete("fullscreen");
    }
    const relativePath = hrefUrl.pathname;

    setHref(`${relativePath}${hrefUrl.search}${hrefUrl.hash}`);
  })


  return (
    <A href={href()}
      class={props.class} style={props.style}>
      {props.children}
    </A>
  )

}
interface LinkProps {
  href: string;
  class?: string;
  style?: any;
  children?: any;
}


