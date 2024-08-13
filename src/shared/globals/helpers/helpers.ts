export class Helpers {
  static firstLetterUppercase(str: string): string {
    const valueString = str.toLowerCase();
    return valueString
      .split(' ')
      .map((value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`)
      .join(' ');
  }

  static lowerCase(str: string): string {
    return str.toLowerCase();
  }

  static generateRandomIntegers(integerLength: number): number {
    const characters = '0123456789';
    let result = ' ';
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
  static parseJson(jsonString: string | null | undefined): Record<string, unknown> | string {
    if (jsonString === null || jsonString === undefined) {
      throw new TypeError('jsonString cannot be null or undefined');
    }

    try {
      return JSON.parse(jsonString); // eslint-disable-line @typescript-eslint/no-unsafe-return
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
