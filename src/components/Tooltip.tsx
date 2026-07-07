import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipPlacement = "top" | "bottom";

interface TooltipProps {
  content: string;
  placement?: TooltipPlacement;
  children: ReactNode;
}

const SHOW_DELAY_MS = 350;
const GAP = 8;
const EDGE_PADDING = 8;

export function Tooltip({
  content,
  placement = "bottom",
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState<CSSProperties>({ top: 0, left: 0 });
  const hostRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<number | null>(null);

  const child = Children.only(children);
  const enhancedChild = isValidElement(child)
    ? cloneElement(child as ReactElement<{ "aria-label"?: string }>, {
        "aria-label":
          (child.props as { "aria-label"?: string })["aria-label"] ?? content,
      })
    : child;

  const clearShowTimer = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const hide = useCallback(() => {
    clearShowTimer();
    setOpen(false);
    setReady(false);
  }, []);

  const updatePosition = useCallback(() => {
    const host = hostRef.current;
    const tip = tipRef.current;
    if (!host || !tip) return;

    const hostRect = host.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let resolvedPlacement = placement;
    const spaceBelow = viewportHeight - hostRect.bottom;
    const spaceAbove = hostRect.top;

    if (
      placement === "bottom" &&
      spaceBelow < tipRect.height + GAP + EDGE_PADDING &&
      spaceAbove > spaceBelow
    ) {
      resolvedPlacement = "top";
    } else if (
      placement === "top" &&
      spaceAbove < tipRect.height + GAP + EDGE_PADDING &&
      spaceBelow > spaceAbove
    ) {
      resolvedPlacement = "bottom";
    }

    let top =
      resolvedPlacement === "bottom"
        ? hostRect.bottom + GAP
        : hostRect.top - tipRect.height - GAP;

    let left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;

    if (left + tipRect.width > viewportWidth - EDGE_PADDING) {
      left = hostRect.right - tipRect.width;
    }
    if (left < EDGE_PADDING) {
      left = hostRect.left;
    }

    left = Math.min(
      Math.max(left, EDGE_PADDING),
      viewportWidth - tipRect.width - EDGE_PADDING,
    );

    top = Math.min(
      Math.max(top, EDGE_PADDING),
      viewportHeight - tipRect.height - EDGE_PADDING,
    );

    setCoords({
      top: `${top}px`,
      left: `${left}px`,
    });
    setReady(true);
  }, [placement]);

  const show = () => {
    clearShowTimer();
    showTimerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, SHOW_DELAY_MS);
  };

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    updatePosition();
  }, [open, content, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => hide, [hide]);

  return (
    <>
      <span
        ref={hostRef}
        className="tooltip-host"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={(event) => {
          if (!hostRef.current?.contains(event.relatedTarget as Node)) {
            hide();
          }
        }}
      >
        {enhancedChild}
      </span>

      {open &&
        createPortal(
          <span
            ref={tipRef}
            className="tooltip-popup"
            role="tooltip"
            style={{
              ...coords,
              opacity: ready ? 1 : 0,
            }}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
