// Loads the 2GIS MapGL JS API on demand and caches the promise.
// MapGL injects `mapgl` onto window.

declare global {
  interface Window {
    mapgl?: any;
  }
}

let promise: Promise<any> | null = null;

export function loadMapGL(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.mapgl) return Promise.resolve(window.mapgl);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-mapgl="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.mapgl));
      existing.addEventListener("error", () => reject(new Error("MapGL failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://mapgl.2gis.com/api/js/v1";
    s.async = true;
    s.dataset.mapgl = "1";
    s.onload = () => (window.mapgl ? resolve(window.mapgl) : reject(new Error("MapGL missing after load")));
    s.onerror = () => reject(new Error("MapGL failed to load"));
    document.head.appendChild(s);
  });
  return promise;
}
