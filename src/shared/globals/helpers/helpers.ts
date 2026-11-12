import os from "os";

export class Helpers {
  /**
   * Returns this machine's first non-loopback IPv4 address, or the IPv4
   * loopback address if none is found.
   *
   * Replaces the unmaintained `ip` npm package (Dependabot alert #1, no
   * patched version available upstream) with the Node.js stdlib equivalent
   * of its `address()` helper — same lookup, same fallback, zero added
   * dependency surface.
   */
  static getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const nic of Object.values(interfaces)) {
      if (!nic) {
        continue;
      }
      for (const details of nic) {
        if (details.family === "IPv4" && !details.internal) {
          return details.address;
        }
      }
    }
    return "127.0.0.1";
  }

  static firstLetterUppercase(str: string): string {
    const valueString = str.toLowerCase();
    return valueString
      .split(" ")
      .map(
        (value: string) =>
          `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`,
      )
      .join(" ");
  }

  static lowerCase(str: string): string {
    return str.toLowerCase();
  }

  static generateRandomIntegers(integerLength: number): number {
    const characters = "0123456789";
    let result = " ";
    const charactersLength = characters.length;
    for (let i = 0; i < integerLength; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return parseInt(result, 10);
  }
  /**
   * Parses a JSON string and returns the parsed object.
   * If parsing fails, it returns the original string.
   *
   * @param {string | null | undefined} jsonString - The JSON string to parse.
   * @throws {TypeError} If jsonString is null or undefined.
   * @return {Record<string, unknown> | string} The parsed JSON object or the original string.
   */
  static parseJson(
    jsonString: string | null | undefined,
  ): Record<string, unknown> | string {
    if (jsonString === null || jsonString === undefined) {
      throw new TypeError("jsonString cannot be null or undefined");
    }

    try {
      return JSON.parse(jsonString);
    } catch {
      // TODO: Use a logger to log the invalid JSON string
      return jsonString;
    }
  }

  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // static parseJSON(prop: string): any {
  //   try {
  //     return JSON.parse(prop);
  //   } catch (error) {
  //     return prop;
  //   }
  // }
}
