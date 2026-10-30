/**
 * Universal Binary & Buffer Conversion Utilities.
 * Safely converts any binary input, file, blob, view, or wrapper into a standard ArrayBuffer or Uint8Array.
 * Prevents "e.arrayBuffer is not a function" errors across all browsers, Electron, and Android WebViews.
 */

export async function toArrayBuffer(input: unknown): Promise<ArrayBuffer> {
  if (input == null) {
    throw new Error('Cannot convert null or undefined to ArrayBuffer');
  }

  // If it's a promise, await it
  if (input instanceof Promise || (typeof input === 'object' && input !== null && 'then' in input && typeof (input as any).then === 'function')) {
    return toArrayBuffer(await (input as Promise<unknown>));
  }

  // Direct ArrayBuffer
  if (input instanceof ArrayBuffer) {
    return input;
  }

  // TypedArray / ArrayBufferView (Uint8Array, Buffer, Int32Array, DataView, etc.)
  if (ArrayBuffer.isView(input)) {
    const { buffer, byteOffset, byteLength } = input;
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer as ArrayBuffer;
    }
    return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
  }

  // Blob or File (test instance or Duck-type with size, type, slice)
  const isBlobLike =
    (typeof Blob !== 'undefined' && input instanceof Blob) ||
    (typeof File !== 'undefined' && input instanceof File) ||
    (typeof input === 'object' && input !== null && typeof (input as any).slice === 'function' && typeof (input as any).size === 'number');

  if (isBlobLike) {
    const blob = input as Blob;
    // 1. Try native arrayBuffer()
    if (typeof blob.arrayBuffer === 'function') {
      try {
        return await blob.arrayBuffer();
      } catch {
        // Fall back below if arrayBuffer() throws
      }
    }
    // 2. Try modern blob.bytes()
    if (typeof (blob as any).bytes === 'function') {
      try {
        const u8 = await (blob as any).bytes();
        if (ArrayBuffer.isView(u8)) {
          return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
        }
      } catch {
        // Fall back below
      }
    }
    // 3. Fallback: Response(blob).arrayBuffer()
    if (typeof Response !== 'undefined') {
      try {
        return await new Response(blob).arrayBuffer();
      } catch {
        // Fall back to FileReader
      }
    }
    // 4. Fallback: FileReader
    if (typeof FileReader !== 'undefined') {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader did not produce an ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader failed to read blob'));
        reader.readAsArrayBuffer(blob);
      });
    }
  }

  // Wrapper objects: { file: ... }, { blob: ... }, { data: ... }, { bytes: ... }, { buffer: ... }
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if ('file' in obj && obj.file != null && typeof obj.file !== 'function' && obj.file !== input) {
      return toArrayBuffer(obj.file);
    }
    if ('blob' in obj && obj.blob != null && typeof obj.blob !== 'function' && obj.blob !== input) {
      return toArrayBuffer(obj.blob);
    }
    if ('data' in obj && obj.data != null && typeof obj.data !== 'function' && obj.data !== input) {
      return toArrayBuffer(obj.data);
    }
    if ('bytes' in obj && obj.bytes != null && typeof obj.bytes !== 'function' && obj.bytes !== input) {
      return toArrayBuffer(obj.bytes);
    }
    if ('buffer' in obj && obj.buffer != null && typeof obj.buffer !== 'function' && obj.buffer !== input && (obj.buffer instanceof ArrayBuffer || ArrayBuffer.isView(obj.buffer))) {
      return toArrayBuffer(obj.buffer);
    }
  }

  // Objects that have a custom .arrayBuffer() method
  if (typeof input === 'object' && input !== null && typeof (input as any).arrayBuffer === 'function') {
    return await (input as any).arrayBuffer();
  }

  // Base64 string or Data URL
  if (typeof input === 'string') {
    let base64 = input.trim();
    if (base64.startsWith('data:')) {
      const commaIdx = base64.indexOf(',');
      if (commaIdx !== -1) {
        base64 = base64.slice(commaIdx + 1);
      }
    }
    if (typeof atob === 'function') {
      try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer as ArrayBuffer;
      } catch {
        // String wasn't valid base64
      }
    }
  }

  throw new Error(`Unsupported binary input type: ${Object.prototype.toString.call(input)}`);
}

/**
 * Convenience helper to get a Uint8Array from any binary input.
 */
export async function toUint8Array(input: unknown): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  const buffer = await toArrayBuffer(input);
  return new Uint8Array(buffer);
}
