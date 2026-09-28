import type { Transition } from 'framer-motion'

export const EASE = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
  flightX: [0.45, 0, 0.2, 1],
  flightY: [0.6, 0, 0.9, 0.7],
} as const

export const SPRING: Transition = { type: 'spring', bounce: 0.12, visualDuration: 0.33 }
export const SPRING_BOUNCE: Transition = { type: 'spring', bounce: 0.28, visualDuration: 0.42 }
export const INSTANT: Transition = { duration: 0 }

export const DURATION = {
  press: 0.14,
  cardPress: 0.16,
  tooltip: 0.125,
  popoverOpen: 0.19,
  popoverClose: 0.11,
  menuClose: 0.12,
  alertOpen: 0.22,
  alertClose: 0.14,
  sheetOpen: 0.26,
  sheetClose: 0.16,
  scrim: 0.22,
  toastEnter: 0.34,
  toastExit: 0.18,
  crossfadeOut: 0.11,
  crossfadeIn: 0.19,
  viewFade: 0.2,
  listInsert: 0.28,
  listRemove: 0.22,
  flip: 0.32,
  drawerOpen: 0.3,
  drawerClose: 0.2,
  bump: 0.42,
  receive: 0.9,
  flight: 0.56,
} as const

export const PRESET = {
  press: { duration: DURATION.press, ease: EASE.out },
  popoverIn: { duration: DURATION.popoverOpen, ease: EASE.out, opacity: { duration: 0.15 } },
  popoverOut: { duration: DURATION.popoverClose, ease: EASE.out },
  crossfadeIn: { duration: DURATION.crossfadeIn, ease: EASE.out },
  crossfadeOut: { duration: DURATION.crossfadeOut, ease: 'easeOut' },
  listIn: { duration: DURATION.listInsert, ease: EASE.out },
  listOut: { duration: DURATION.listRemove, ease: EASE.out },
  flip: { duration: DURATION.flip, ease: EASE.inOut },
  drawerIn: { duration: DURATION.drawerOpen, ease: EASE.drawer },
  drawerOut: { duration: DURATION.drawerClose, ease: EASE.drawer },
} satisfies Record<string, Transition>
