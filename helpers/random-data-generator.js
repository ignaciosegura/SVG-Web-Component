// Dummy data generator.
// Specify type and range, it returns a random piece of data.

export default class RandomDataGenerator {
    static generateInteger (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static generateFloat (min, max) {
        let range = max - min;
        return (Math.random() * range) + min;
    }

    static generateRiggedFloat (min, max, probabilityMax) {
        let rigFactor = probabilityMax + 1;
        let range = (max * rigFactor) - min;
        let unRigged = (Math.random() * range) + min;
        return unRigged > max
            ? max
            : unRigged;
    }

    static generateBool (probability = 0.5) {
        let base = Math.random();

        return base <= 0.5;
	}

    static generateColorRGB() {
        return `rgb(${this.generateInteger(0, 255)},${this.generateInteger(0, 255)},${this.generateInteger(0, 255)})`;
    }
}
