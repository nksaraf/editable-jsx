"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  r3f: () => r3f
});
module.exports = __toCommonJS(src_exports);
var import_core2 = require("@babel/core");
var import_babel = require("@editable-jsx/babel");
var import_plugin_react = __toESM(require("@vitejs/plugin-react"));

// src/server/hmr.ts
var filesToSkipOnHmr = /* @__PURE__ */ new Map();

// src/server/server.ts
var import_formidable = __toESM(require("formidable"));
var import_fs = require("fs");
var import_fs_extra3 = require("fs-extra");
var import_path = require("path");
var import_vite_dev_rpc = require("vite-dev-rpc");

// src/patcher/index.ts
var import_fs_extra = require("fs-extra");

// src/patcher/ts-morph.ts
var import_ts_morph = require("ts-morph");
var tsProject = new import_ts_morph.Project({
  tsConfigFilePath: "tsconfig.json"
});
function isPos(el, pos) {
  return el.getStartLineNumber() === pos.lineNumber && el.getStart() - el.getStartLinePos() + 1 === pos.columnNumber;
}
var findElement = (sourceFile, pos) => {
  for (let x of sourceFile.getDescendantsOfKind(import_ts_morph.SyntaxKind.JsxOpeningElement)) {
    console.log(x.getText());
    if (isPos(x, pos)) {
      return x;
    }
  }
  for (let x of sourceFile.getDescendantsOfKind(
    import_ts_morph.SyntaxKind.JsxSelfClosingElement
  )) {
    if (isPos(x, pos)) {
      return x;
    }
  }
};
var valueExpression = (value) => {
  if (typeof value.expression === "string") {
  } else if (Array.isArray(value)) {
    return `{[${value.join(", ")}]}`;
  }
  if (typeof value === "string") {
    return `"${value}"`;
  } else if (typeof value === "number") {
    return `{${value}}`;
  } else if (typeof value === "boolean") {
    return `{${value}}`;
  }
};
function setAttribute(el, propPath, propValue) {
  for (var attribute of el.getDescendantsOfKind(import_ts_morph.SyntaxKind.JsxAttribute)) {
    if (attribute.compilerNode.name.text === propPath) {
      if (typeof propValue === "object" && !Array.isArray(propValue)) {
        attribute.getInitializer().replaceWithText(`{${JSON.stringify(propValue)}}`);
      } else {
        const propValueString = valueExpression(propValue);
        if (!propValueString) {
          throw new Error(`Could not parse prop value`);
        }
        attribute.getInitializer().replaceWithText(`${propValueString}`);
      }
    }
  }
}
async function tsMorphPatcher(fileName, code, patches) {
  let sourceFile;
  if (sourceFile = tsProject.getSourceFile(fileName)) {
    tsProject.removeSourceFile(sourceFile);
    sourceFile = tsProject.addSourceFileAtPath(fileName);
  } else {
    sourceFile = tsProject.addSourceFileAtPath(fileName);
  }
  sourceFile?.replaceWithText(code);
  patches.forEach((patch) => {
    const { action_type, source, value } = patch;
    if (action_type === "updateAttribute") {
      console.log("setting", value, patches[0].source);
      let el = findElement(sourceFile, patches[0].source);
      if (!el) {
        throw new Error(`Could not find element`);
      }
      Object.entries(value).forEach(([propPath, propValue]) => {
        setAttribute(el, propPath, propValue);
      });
    }
  });
  return sourceFile.getFullText();
}

// src/patcher/index.ts
var groupPatchesByFileName = (patches) => {
  return patches.reduce((accum, x) => {
    ;
    (accum[x.source.fileName] = accum[x.source.fileName] || []).push(x);
    return accum;
  }, {});
};
async function applyFilePatches(fileName, patches) {
  let code = (await (0, import_fs_extra.readFile)(fileName)).toString();
  code = await tsMorphPatcher(
    fileName,
    code,
    patches.filter((p) => p.action_type === "updateAttribute")
  );
  await (0, import_fs_extra.writeFile)(fileName, code);
}
async function applyPatches(data) {
  const grouped = groupPatchesByFileName(data);
  await Promise.all(
    Object.entries(grouped).map(async ([fileName, patches]) => {
      return applyFilePatches(fileName, patches).catch((err) => {
        console.log(
          `Something went wrong while applying patches to ${fileName}`
        );
        console.error(err);
      });
    })
  );
}

// src/server/components.ts
var import_recast = require("@vinxi/recast");
var import_babel_ts = require("@vinxi/recast/parsers/babel-ts");
var import_fast_glob = __toESM(require("fast-glob"));
var import_fs_extra2 = require("fs-extra");

// src/utils/babel.ts
var import_core = require("@babel/core");
var getReactComponents = (node) => {
  if (!import_core.types.isExportDefaultDeclaration(node) && !import_core.types.isExportNamedDeclaration(node))
    return;
  let id;
  let body = false;
  if (import_core.types.isFunctionDeclaration(node.declaration) && node.declaration.id) {
    id = node.declaration.id;
    body = node.declaration.body;
  } else if (import_core.types.isVariableDeclaration(node.declaration) && node.declaration.declarations.length && import_core.types.isVariableDeclarator(node.declaration.declarations[0]) && import_core.types.isIdentifier(node.declaration.declarations[0].id)) {
    if (import_core.types.isArrowFunctionExpression(node.declaration.declarations[0].init) && import_core.types.isBlockStatement(node.declaration.declarations[0].init.body)) {
      id = node.declaration.declarations[0].id;
      body = node.declaration.declarations[0].init.body;
    } else if (import_core.types.isCallExpression(node.declaration.declarations[0].init) && import_core.types.isIdentifier(node.declaration.declarations[0].init.callee) && node.declaration.declarations[0].init.callee.name === "forwardRef") {
      id = node.declaration.declarations[0].id;
      body = true;
    }
  }
  if (body && id) {
    if (typeof body === "boolean" && body) {
      return {
        componentName: id.name,
        node
      };
    }
    const isJsx = body.body.some((n) => {
      if (import_core.types.isReturnStatement(n)) {
        if (import_core.types.isJSXElement(n.argument)) return true;
        if (import_core.types.isParenthesizedExpression(n.argument) && import_core.types.isJSXElement(n.argument.expression))
          return true;
        return false;
      }
    });
    const isHook = body.body.some(
      (n) => import_core.types.isExpressionStatement(n) && import_core.types.isCallExpression(n.expression) && import_core.types.isIdentifier(n.expression.callee) && n.expression.callee.name.startsWith("use")
    );
    console.log(id.name, isJsx, isHook);
    if (isJsx || isHook) {
      return {
        componentName: id.name,
        node
      };
    }
  }
};

// src/server/components.ts
async function listComponents(componentsDir) {
  const componentFiles = await (0, import_fast_glob.default)(componentsDir, {
    cwd: process.cwd()
  });
  const files = await Promise.all(componentFiles.map(listReactComponents));
  return files.filter((f) => f.components.length);
}
async function listReactComponents(fileName) {
  try {
    const source = await (0, import_fs_extra2.readFile)(fileName);
    const sourceAst = (0, import_recast.parse)(source.toString(), {
      parser: { parser: import_babel_ts.parser, parse: import_babel_ts.parse },
      jsx: true
    });
    const program = sourceAst.program;
    const components = program.body.map((node) => {
      const compo = getReactComponents(node);
      if (compo) {
        return compo.componentName;
      }
    }).filter(Boolean);
    return {
      fileName,
      components
    };
  } catch (error) {
    console.log("something went wring while parsing the file");
    return {
      fileName,
      components: []
    };
  }
}

// src/server/server.ts
var configureMiddlewares = (server) => {
  server.middlewares.use("/__editor/save", async (req, res) => {
    let response = await new Promise((resolve2, reject) => {
      (0, import_formidable.default)({
        multiples: true,
        keepExtensions: true,
        filename(name, ext, part, form) {
          return req.url.slice(1);
        }
      }).parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        }
        const texturepath = `public/textures/${decodeURIComponent(
          req.url.slice(1)
        )}`;
        if ((0, import_fs.existsSync)(texturepath)) {
          (0, import_fs_extra3.removeSync)(texturepath);
        }
        (0, import_fs_extra3.moveSync)(files["file"].filepath, texturepath);
        resolve2(
          JSON.stringify(
            "/textures/" + decodeURIComponent(req.url.slice(1)),
            null,
            2
          )
        );
      });
    });
    res.setHeader("Content-Type", "application/json");
    res.end(response);
  });
};
var configureServer = (options) => {
  return (server) => {
    (0, import_vite_dev_rpc.createRPCServer)(
      "react-three-editor",
      server.ws,
      {
        async save(data) {
          if (!data) {
            throw new Error(`no data`);
          }
          if (!Array.isArray(data)) {
            data = [data];
          }
          await applyPatches(data);
        },
        async initializeComponentsWatcher() {
          try {
            const componentsDir = (0, import_path.resolve)(
              process.cwd(),
              "src",
              "components",
              "**/*.{tsx,jsx}"
            );
            return await listComponents(componentsDir);
          } catch (error) {
            console.log("something went wrong while initializing the watcher");
            return [];
          }
        }
      }
    );
    configureMiddlewares(server);
  };
};

// src/server/index.ts
var editor = (options = {}) => {
  return {
    name: "vite-plugin-react-three-editor",
    enforce: "pre",
    handleHotUpdate(ctx) {
      if (filesToSkipOnHmr.get(ctx.file)?.skip === true) {
        filesToSkipOnHmr.get(ctx.file).skip = false;
        filesToSkipOnHmr.get(ctx.file).timeout = 0;
        console.log("silently updated", ctx.file);
        return [];
      }
    },
    transformIndexHtml: async (id, prop) => {
      return [
        {
          tag: "link",
          attrs: {
            type: "text/css",
            rel: "stylesheet",
            href: "/node_modules/@react-three/editor/assets/style.css"
          }
        }
      ];
    },
    configureServer: configureServer(options)
  };
};

// src/index.ts
var shouldEdit = (node) => {
  return true;
  let isEditableComponent = (node2) => node2.attributes.some(
    (attr) => import_core2.types.isJSXAttribute(attr) && (attr.name.name === "position" || attr.name.name === "rotation" || attr.name.name === "scale" || attr.name.name === "name")
  ) || import_core2.types.isJSXIdentifier(node2.name) && ["OrbitControls", "Physics"].includes(node2.name.name) || import_core2.types.isJSXIdentifier(node2.name) && (node2.name.name.endsWith("Material") || node2.name.name.endsWith("Geometry")) || import_core2.types.isJSXMemberExpression(node2.name) && (node2.name.property.name.endsWith("Material") || node2.name.property.name.endsWith("Geometry"));
  switch (node.type) {
    case "primitive":
      return true;
    case "namespaced-primitive":
      return true;
    case "component":
      return isEditableComponent(node.openingElement);
    case "namespaced-component":
      return isEditableComponent(node.openingElement);
  }
};
function r3f({
  babelPlugins = [],
  editable = shouldEdit,
  enabled = true,
  componentsDir = "src/components"
} = {}) {
  return enabled ? [
    editor(),
    (0, import_plugin_react.default)({
      babel: {
        plugins: [
          ...babelPlugins,
          [
            import_babel.reactThreeEditorBabel,
            {
              importPath: "react-dom/client",
              replaceImports: {
                // "@react-three/fiber": "@react-three/editor/fiber"
              },
              imports: {
                path: "@editable-jsx/editable",
                imports: [
                  "editable",
                  "Editable"
                  // "useEditorFrame",
                  // "useEditorUpdate"
                ]
              },
              isEditable: editable
            }
          ]
        ]
      }
    })
  ] : [(0, import_plugin_react.default)()];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  r3f
});
