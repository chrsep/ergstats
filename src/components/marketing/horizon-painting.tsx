import { getImageProps } from "next/image";

import tall from "./images/horizon-tall.jpg";
import wide from "./images/horizon-wide.jpg";

/**
 * The home hero's backdrop: an oil painting of dark water under a low, glowing horizon. Phones get a
 * portrait version so the line stays low on a tall screen. Both fill their frame with object-fit:
 * cover, which scales them wider than the frame, hence the generous `sizes`.
 */
export function HorizonPainting({ className }: { className?: string }) {
  const common = { alt: "", loading: "eager", fetchPriority: "high" } as const;
  const {
    props: { srcSet: wideSrcSet, sizes: wideSizes },
  } = getImageProps({ ...common, src: wide, sizes: "(min-width: 105rem) 1680px, (min-width: 64rem) 100vw, 140vw" });
  const { props } = getImageProps({ ...common, src: tall, sizes: "140vw" });

  return (
    <picture>
      <source media="(min-width: 48rem)" srcSet={wideSrcSet} sizes={wideSizes} />
      <img {...props} alt="" className={className} />
    </picture>
  );
}
