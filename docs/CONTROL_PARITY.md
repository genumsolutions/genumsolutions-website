# Control-surface parity — scope note

The canonical requirements register, root causes and session log live in the app repo:

`genumsolutions-app/docs/DEVICE_CONTROL_ROADMAP.md`

## Owner clarification (2026-11-19)

> "website controls for the 2wd1m mode means the one that ESP hosts, not the Genum
> website yet."

So the control work requested in this round is **not** in this repository. It is on the page the
2WD1M car serves at `/`, implemented in:

`Genum_2WD1M_CAR_NEW/WebPage.h`

The Genum website's `/tools` car surface (`components/RoboCarControl.tsx`) is unchanged by this
round. It already detects the mode (`mode.controls.includes("drive-2wd1m")`) and drives it with two
virtual joysticks; if the owner later wants the app's d-pad deck here too, that is a separate
request and this file is the place to record it.

## Status of this repo

No code change from this round. A `components/CarDpad.tsx` draft was created and then removed once
the clarification landed, so the working tree stays clean.
