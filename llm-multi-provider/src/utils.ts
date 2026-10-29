// packages/core/src/Agents/utils.ts

export function isJsonString(str: string): boolean {
    if (typeof str !== 'string') return false;
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

export function deepParseJson(obj: any): any {
    if (typeof obj === 'string' && isJsonString(obj)) {
        try {
            return deepParseJson(JSON.parse(obj));
        } catch (e) {
            return obj;
        }
    } else if (Array.isArray(obj)) {
        return obj.map(item => deepParseJson(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = deepParseJson(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}

export function unwrapArguments(args: any): any {
     if (typeof args === 'object' && args !== null && Object.prototype.hasOwnProperty.call(args, 'params') && typeof args.params === 'object' && args.params !== null) {
        console.debug("Unwrapping arguments from 'params' property.");
        return args.params;
    }
    console.debug("Arguments not wrapped in 'params', using original structure.");
    return args;
}