# Plan for supporting multiple WLED clients

This plan outlines the steps to refactor the `LedAnimationApp` to support broadcasting LED animations to multiple WLED devices (clients) simultaneously.

## Objectives

- Enable `LedAnimationApp` to manage and broadcast to an arbitrary number of `WLEDDdp` sockets.
- Allow new WLED clients to "check in" and be added to the active broadcast list without restarting the entire application.
- Ensure all active clients receive brightness updates and animation frames.

## Tasks

### 1. Refactor `LedAnimationApp` (`src/server-wled.ts`)

- [ ] Change `private readonly socket: WLEDDdp;` to `private readonly sockets: Set<WLEDDdp> = new Set();`.
- [ ] Update constructor to initialize the `sockets` set and handle the initial client if provided.
- [ ] Implement `public addClient(config: WledAppConfig): void` method:
  - Create a new `WLEDDdp` instance with the provided config.
  - Add it to the `sockets` set.
  - Call `initLeds()` on the new socket (or handle async initialization).
- [ ] Refactor `update()` method:
  - Iterate over all `sockets` in the set and call `send(leds)` or `sendEmpty()` for each.
- [ ] Refactor `setBrightness(brightness: number)` method:
  - Iterate over all `sockets` and call `setBrightness(brightness)`.
- [ ] Update `stop()` method to stop/cleanup all sockets in the set.

### 2. Refactor Client Check-in logic (`src/server.ts`)

- [ ] Modify the endpoint that handles client check-ins (e.g., `/checkin` or similar):
  - Instead of replacing the single `Data.wledConfig`, call `LedAnimationApp.addClient(...)`.
  - Ensure the application is started if it's not already running.

### 3. Verification

- [ ] Test with a single client (regression test).
- [ ] Test with multiple clients simultaneously sending different `client_id`s and `wled_host`s.
- [ ] Verify that brightness changes apply to all connected clients.
- [ ] Verify that adding a new client mid-stream works without interrupting existing ones.

## Notes

- We need to be careful about how `PixelImagePlayer` is initialized. It currently uses `config.client`. If we have multiple clients, they might have different pixel counts. However, the _animation_ content is likely common, so the player should probably use a sufficiently large canvas or adapt to the largest client's needs?
- Actually, if each client has its own number of pixels, `WLEDDdp.send` handles the data length via `flush`. But we need to ensure all clients are updated. If one client has 100 LEDs and another has 1000, sending a 1000-pixel array to both is fine as long as the 100-LED one only processes its part or doesn't crash.
- Looking at `WLEDDdp.send`, it uses `data.flat()`. It doesn't truncate. But `WLEDDdp` constructor takes `ledCount`. If we send more than `ledCount`, WLED might ignore the extra data or error out.
- Wait, if I send a 1000-pixel array to a 100-pixel socket, it will try to send all 1000 pixels. This might be bad for the 100-pixel device.
- **Crucial realization**: Each socket _must_ only receive up to its `ledCount`. I need to handle this in the `update()` loop.
