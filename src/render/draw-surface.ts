/**
 * The only drawing capability the renderer is allowed to assume.
 *
 * Deliberately narrow, and deliberately not `CanvasRenderingContext2D`. A
 * two-method interface can be implemented by a recording stub in a unit test,
 * which means the scene-drawing logic is testable without a browser, a canvas,
 * or a native dependency. The real canvas adapter is the only code that has to
 * touch the DOM, and it is correspondingly tiny.
 */
export interface DrawSurface {
  /** Wipe the frame before drawing the next one. */
  clear(): void;
  /** Draw the named atlas sprite with its top-left corner at (x, y). */
  drawSprite(name: string, x: number, y: number): void;
}

/**
 * One sprite positioned in the frame, in screen pixels.
 *
 * Not exported: nothing outside this module needs to name the type yet, and
 * knip treats an export nobody imports as dead weight. It becomes exported the
 * moment a scene builder actually needs it.
 */
interface SceneSprite {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Everything the renderer needs to draw one frame.
 *
 * The renderer takes this rather than the game state itself, which keeps
 * drawing decoupled from the shape of the rules. Sprites are drawn in array
 * order, so the array is the z-order.
 */
export interface Scene {
  readonly sprites: readonly SceneSprite[];
}
