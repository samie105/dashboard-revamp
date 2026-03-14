// src/functions.ts
function createVividFunction(config) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.name)) {
    throw new Error(
      `Invalid function name "${config.name}". Must start with a letter or underscore and contain only alphanumeric characters and underscores.`
    );
  }
  if (!config.description || config.description.trim().length === 0) {
    throw new Error(`Function "${config.name}" must have a description.`);
  }
  return {
    ...config,
    executionContext: config.executionContext ?? "client"
  };
}
var FunctionRegistry = class {
  constructor() {
    this.functions = /* @__PURE__ */ new Map();
  }
  /**
   * Register a function
   */
  register(config) {
    if (this.functions.has(config.name)) {
      console.warn(`[Vivid] Function "${config.name}" is already registered. Overwriting.`);
    }
    this.functions.set(config.name, config);
  }
  /**
   * Register multiple functions at once
   */
  registerAll(configs) {
    for (const config of configs) {
      this.register(config);
    }
  }
  /**
   * Unregister a function by name
   */
  unregister(name) {
    return this.functions.delete(name);
  }
  /**
   * Get a function by name
   */
  get(name) {
    return this.functions.get(name);
  }
  /**
   * Check if a function is registered
   */
  has(name) {
    return this.functions.has(name);
  }
  /**
   * Get all registered functions
   */
  getAll() {
    return Array.from(this.functions.values());
  }
  /**
   * Get all client-side functions
   */
  getClientFunctions() {
    return this.getAll().filter((fn) => fn.executionContext === "client");
  }
  /**
   * Get all server-side functions
   */
  getServerFunctions() {
    return this.getAll().filter((fn) => fn.executionContext === "server");
  }
  /**
   * Convert all registered functions to OpenAI tool definitions
   */
  toOpenAITools() {
    return this.getAll().map(functionToOpenAITool);
  }
  /**
   * Clear all registered functions
   */
  clear() {
    this.functions.clear();
  }
  /**
   * Get the count of registered functions
   */
  get size() {
    return this.functions.size;
  }
};
function functionToOpenAITool(config) {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters
  };
}
async function executeFunction(registry, name, args) {
  const startTime = performance.now();
  const fn = registry.get(name);
  if (!fn) {
    return {
      success: false,
      error: `Function "${name}" not found`,
      executionTime: performance.now() - startTime
    };
  }
  try {
    const result = await fn.handler(args);
    return {
      success: true,
      result,
      executionTime: performance.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime
    };
  }
}
function stringParam(description, required = true) {
  return { type: "string", description, _required: required };
}
function numberParam(description, required = false) {
  return { type: "number", description, _required: required };
}
function booleanParam(description, required = false) {
  return { type: "boolean", description, _required: required };
}
function enumParam(description, options, required = false) {
  return { type: "string", description, enum: options, _required: required };
}
function buildParameters(params) {
  const properties = {};
  const required = [];
  for (const [key, param] of Object.entries(params)) {
    const { _required, ...prop } = param;
    properties[key] = prop;
    if (_required) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    ...required.length > 0 ? { required } : {}
  };
}

export { FunctionRegistry, booleanParam, buildParameters, createVividFunction, enumParam, executeFunction, functionToOpenAITool, numberParam, stringParam };
//# sourceMappingURL=functions.mjs.map
//# sourceMappingURL=functions.mjs.map