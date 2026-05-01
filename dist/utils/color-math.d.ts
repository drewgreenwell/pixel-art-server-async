import { Led } from './data-wled.js';
/**
 * Utility class for color-related mathematical calculations
 */
export declare class ColorMath {
    /**
     * Converts HSV color values to RGB
     * @param h - Hue value (0-360)
     * @param s - Saturation value (0-1)
     * @param v - Value/Brightness (0-1)
     * @returns RGB values as a readonly tuple [r, g, b] with values from 0-255
     */
    static hsvToRgb(h: number, s: number, v: number): Led;
    /**
     * Generates an array of LEDs with rainbow colors
     * @param count - Number of LEDs to generate
     * @param offset - Value to offset the Hue by, default 0
     * @param saturation - Color saturation (0-1), default 1
     * @param value - Color brightness (0-1), default 1
     * @returns Array of LED objects with RGB values
     */
    static generateRainbow(count: number, shift?: number, saturation?: number, value?: number): readonly Led[];
}
