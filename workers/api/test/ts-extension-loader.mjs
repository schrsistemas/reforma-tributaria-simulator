/**
 * Node's native TypeScript stripping does not remap ESM .js specifiers to
 * their corresponding .ts source files. This test-only loader provides that
 * mapping without changing production imports or TypeScript compiler settings.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      specifier.endsWith('.js')
    ) {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
    throw error;
  }
}
