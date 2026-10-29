import { Type, type Schema } from "@google/genai";

export class SchemaMapper {
  /**
   * Converts a Google Gemini Schema into a Strict JSON Schema compatible with
   * OpenAI/OpenRouter's "Structured Outputs" feature.
   *
   * STRICT MODE RULES APPLIED:
   * 1. All properties in an object MUST be included in the 'required' array.
   * 2. 'additionalProperties' MUST be false for all objects.
   * 3. Optional fields (not in Google's 'required' array or explicitly nullable)
   *    are represented as a Union type, e.g., ["string", "null"].
   * 4. Enums are preserved.
   */
  static mapToOpenAI(googleSchema: Schema): Record<string, any> {
    // The top-level schema is always considered "required" for the payload.
    return this.convertSchema(googleSchema, true);
  }

  /**
   * Recursive conversion function.
   * @param schema - The Google schema node to convert.
   * @param isRequiredInParent - Whether this node was listed in its parent's 'required' array.
   *                             This is the key to determining nullability.
   */
  private static convertSchema(
    schema: Schema,
    isRequiredInParent: boolean
  ): Record<string, any> {
    // Cast to any to access properties safely since Google's Schema type is a Union
    const s = schema as any;
    const jsonSchema: Record<string, any> = {};

    // 1. Map Description
    if (s.description) {
      jsonSchema.description = s.description;
    }

    // 2. Determine Base Type
    const baseType = s.type ? this.mapTypeToString(s.type) : "string";

    // 3. Handle Nullability (The Strict Mode Bridge)
    // A field is considered optional (and thus must be nullable in strict mode) if:
    // a) It was explicitly marked as nullable in the Google schema.
    // b) It was NOT listed in its parent object's 'required' array.
    const isNullable = s.nullable === true || !isRequiredInParent;

    if (isNullable) {
      // OpenRouter Strict Mode requires a union type for optional fields.
      jsonSchema.type = [baseType, "null"];
    } else {
      jsonSchema.type = baseType;
    }

    // 4. Map Enums
    if (s.enum) {
      jsonSchema.enum = s.enum;
    }

    // 5. Map Arrays
    if (baseType === "array") {
      if (s.items) {
        // Items in an array are structurally required, so we pass `true`.
        jsonSchema.items = this.convertSchema(s.items, true);
      } else {
        // Fallback: OpenAI Strict Mode requires a defined `items` schema.
        jsonSchema.items = { type: "string" };
      }
    }

    // 6. Map Objects (Strict Mode Enforcement)
    if (baseType === "object") {
      jsonSchema.properties = {};
      jsonSchema.additionalProperties = false; // REQUIRED for Strict Mode

      const allKeys: string[] = [];

      if (s.properties) {
        // Get the set of keys that were explicitly required in the Google definition
        const googleRequiredSet = new Set(s.required || []);

        for (const [key, propSchema] of Object.entries(s.properties)) {
          // Check if this specific property was required in the original Google schema
          const isPropRequiredInGoogleSchema = googleRequiredSet.has(key);

          // Recurse, passing down whether the property was originally required.
          // This determines if the child property needs to be nullable.
          jsonSchema.properties[key] = this.convertSchema(
            propSchema as Schema,
            isPropRequiredInGoogleSchema
          );

          // STRICT MODE RULE: All properties defined must be listed in 'required'.
          // Optionality is handled via the ["type", "null"] union on the child,
          // not by omitting the key from this array.
          allKeys.push(key);
        }
      }

      // STRICT MODE: 'required' must be present and contain ALL property keys.
      jsonSchema.required = allKeys;
    }

    return jsonSchema;
  }

  /**
   * Helper to convert Google SchemaType enum/string to a standard JSON Schema type string.
   */
  private static mapTypeToString(type: Type | string): string {
    const t = String(type).toUpperCase();
    switch (t) {
      case "STRING": case String(Type.STRING): return "string";
      case "NUMBER": case String(Type.NUMBER): return "number";
      case "INTEGER": case String(Type.INTEGER): return "integer";
      case "BOOLEAN": case String(Type.BOOLEAN): return "boolean";
      case "ARRAY": case String(Type.ARRAY): return "array";
      case "OBJECT": case String(Type.OBJECT): return "object";
      default: return "string";
    }
  }
}