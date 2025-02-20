import 'kleur/colors';
import { g as decodeKey } from './chunks/astro/server_BRr-nifv.mjs';
import 'clsx';
import 'cookie';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_GI9zL1jZ.mjs';
import 'es-module-lexer';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///home/adam/Projects/docs-AI/","cacheDir":"file:///home/adam/Projects/docs-AI/node_modules/.astro/","outDir":"file:///home/adam/Projects/docs-AI/dist/","srcDir":"file:///home/adam/Projects/docs-AI/src/","publicDir":"file:///home/adam/Projects/docs-AI/public/","buildClientDir":"file:///home/adam/Projects/docs-AI/dist/client/","buildServerDir":"file:///home/adam/Projects/docs-AI/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/chat","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/chat\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"chat","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/chat.ts","pathname":"/api/chat","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/adam/Projects/docs-AI/src/pages/index.astro",{"propagation":"none","containsHead":true}],["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["/home/adam/Projects/docs-AI/src/components/Navigation.astro",{"propagation":"in-tree","containsHead":false}],["/home/adam/Projects/docs-AI/src/layouts/DocsLayout.astro",{"propagation":"in-tree","containsHead":false}],["/home/adam/Projects/docs-AI/src/pages/docs/[version]/[...slug].astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/docs/[version]/[...slug]@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["/home/adam/Projects/docs-AI/src/pages/docs/[version]/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/docs/[version]/index@_@astro",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:src/pages/docs/[version]/index@_@astro":"pages/docs/_version_.astro.mjs","\u0000@astro-page:src/pages/docs/[version]/[...slug]@_@astro":"pages/docs/_version_/_---slug_.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:src/pages/api/chat@_@ts":"pages/api/chat.astro.mjs","/home/adam/Projects/docs-AI/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_0B2oW-19.mjs","/home/adam/Projects/docs-AI/.astro/content-modules.mjs":"chunks/content-modules_Dz-S_Wwv.mjs","\u0000astro:data-layer-content":"chunks/_astro_data-layer-content_C7AX8UbF.mjs","\u0000@astrojs-manifest":"manifest_5fpBXL4F.mjs","/home/adam/Projects/docs-AI/.astro/content-assets.mjs":"chunks/content-assets_CNrzfZTC.mjs","/home/adam/Projects/docs-AI/src/components/Chat":"_astro/Chat.P2VL3pi1.js","@astrojs/react/client.js":"_astro/client.Ck7an2Yk.js","/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=0&lang.ts":"_astro/Navigation.astro_astro_type_script_index_0_lang.DVU4g9nd.js","/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=1&lang.ts":"_astro/Navigation.astro_astro_type_script_index_1_lang.CjkA8A6u.js","/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=2&lang.ts":"_astro/Navigation.astro_astro_type_script_index_2_lang.D3wKJP_4.js","/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=3&lang.ts":"_astro/Navigation.astro_astro_type_script_index_3_lang.BY1oSmrF.js","/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=4&lang.ts":"_astro/Navigation.astro_astro_type_script_index_4_lang.DEx3uTwe.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=0&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{window.location.pathname.includes(\"/fork-skatehive\")&&document.body.setAttribute(\"data-page\",\"fork-skatehive\");const e=document.getElementById(\"openMenu\"),t=document.getElementById(\"sidebarMenu\");e?.addEventListener(\"click\",()=>{t?.classList.toggle(\"active\"),document.body.classList.toggle(\"menu-open\")})});"],["/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=1&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{const t=window.location.pathname;t.includes(\"/fork-skatehive\")&&(e.style.zIndex=\"30\",e.style.top=\"56px\");const n=document.getElementById(\"openMenu\"),e=document.getElementById(\"sidebarMenu\");n?.addEventListener(\"click\",()=>{t.includes(\"/fork-skatehive\")&&(e?.classList.toggle(\"active\"),document.body.classList.toggle(\"menu-open\"))})});"],["/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=2&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{if(window.location.pathname.includes(\"/fork-skatehive\")){const e=document.getElementById(\"sidebarMenu\"),t=document.querySelector(\"nav\");e&&(e.style.zIndex=\"30\",e.style.top=\"56px\",e.style.maxHeight=\"calc(100vh - 56px)\",e.style.overflowY=\"auto\"),t&&(t.style.zIndex=\"40\")}});"],["/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=3&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{const t=document.getElementById(\"languageButton\"),e=document.getElementById(\"languageMenu\");document.getElementById(\"sidebarMenu\"),t?.addEventListener(\"click\",n=>{n.stopPropagation(),e?.classList.toggle(\"visible\"),window.innerWidth<=768&&(e.style.zIndex=\"1000\")}),document.addEventListener(\"click\",n=>{!e?.contains(n.target)&&!t?.contains(n.target)&&e?.classList.remove(\"visible\")}),window.addEventListener(\"resize\",()=>{window.innerWidth>768&&e?.classList.remove(\"visible\")})});"],["/home/adam/Projects/docs-AI/src/components/Navigation.astro?astro&type=script&index=4&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{const t=document.getElementById(\"languageButton\"),s=document.getElementById(\"languageMenu\");let e=!1;t.addEventListener(\"click\",n=>{n.stopPropagation(),e=!e,s.classList.toggle(\"hidden\",!e)}),document.addEventListener(\"click\",n=>{!s.contains(n.target)&&!t.contains(n.target)&&(e=!1,s.classList.add(\"hidden\"))})});const o=document.getElementById(\"openMenu\"),a=document.getElementById(\"sidebarMenu\"),d=document.body;o?.addEventListener(\"click\",()=>{a?.classList.toggle(\"-translate-x-full\"),d.classList.toggle(\"no-scroll\")});document.addEventListener(\"click\",t=>{!a.contains(t.target)&&!o.contains(t.target)&&window.innerWidth<768&&(a.classList.add(\"-translate-x-full\"),d.classList.remove(\"no-scroll\"))});"]],"assets":["/_astro/1.Dp1nD-WF.png","/_astro/2.BrU44sFi.png","/_astro/3.D6OrnYfq.png","/_astro/4.B2pedAIj.png","/_astro/1.BRUk0eyk.png","/_astro/2.7F6C_004.png","/_astro/1.a62idObL.png","/_astro/2.DejN6YYh.png","/_astro/1.CUrek7dk.png","/_astro/3.Clfx3hej.png","/_astro/4.fVtiAEu9.png","/_astro/5.A6BmlQJt.png","/_astro/1.CqQR4CbM.png","/_astro/2.DBnKTIWC.png","/_astro/4.B3gNI4LK.png","/_astro/5.DtNI05TX.png","/_astro/3.BGsXr2ch.png","/_astro/6.DEAkueCO.png","/_astro/7.XX81Ufy3.png","/_astro/3.Dkkp_COD.png","/_astro/9.BcqDdF8Q.png","/_astro/1.DUeNuwlt.png","/_astro/10.8qXeywTJ.png","/_astro/11.Cr_2rhbf.png","/_astro/12.C-ryAtwG.png","/_astro/8.odBEXYyd.png","/_astro/_slug_.B4g4uJ_b.css","/_astro/_slug_.Cjic3Ys6.css","/_astro/index.G3xWrBH2.css","/favicon.svg","/_astro/Chat.P2VL3pi1.js","/_astro/client.Ck7an2Yk.js","/_astro/index.BaVkx4tQ.css","/_astro/index._OACqPSs.js","/index.html"],"buildFormat":"directory","checkOrigin":true,"serverIslandNameMap":[],"key":"PA2C98WDt/ulTrV8RZLplgQR8gm6ns08fhswx954sR4="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
