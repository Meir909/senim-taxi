export type MapGlMapBounds = {
  southWest: [number, number];
  northEast: [number, number];
};

export type MapGlPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MapGlClickEvent = {
  lngLat: [number, number];
};

export type MapGlMap = {
  on: (event: "click", handler: (event: MapGlClickEvent) => void) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: MapGlMapBounds, options: { padding: MapGlPadding }) => void;
  destroy: () => void;
};

export type MapGlMarker = {
  setCoordinates: (coordinates: [number, number]) => void;
  destroy: () => void;
};

export type MapGlPolyline = {
  destroy: () => void;
};

export type MapGlNamespace = {
  Map: new (
    element: HTMLDivElement,
    options: { center: [number, number]; zoom: number; key: string },
  ) => MapGlMap;
  Marker: new (
    map: MapGlMap,
    options: {
      coordinates: [number, number];
      icon: string;
      size: [number, number];
      anchor: [number, number];
    },
  ) => MapGlMarker;
  Polyline: new (
    map: MapGlMap,
    options: {
      coordinates: Array<[number, number]>;
      width: number;
      color: string;
      color2: string;
      width2: number;
    },
  ) => MapGlPolyline;
};

declare global {
  interface Window {
    mapgl?: MapGlNamespace;
  }
}

let promise: Promise<MapGlNamespace> | null = null;

export function loadMapGL(): Promise<MapGlNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.mapgl) return Promise.resolve(window.mapgl);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-mapgl="1"]');
    if (existing) {
      existing.addEventListener("load", () =>
        window.mapgl ? resolve(window.mapgl) : reject(new Error("MapGL missing after load")),
      );
      existing.addEventListener("error", () => reject(new Error("MapGL failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://mapgl.2gis.com/api/js/v1";
    s.async = true;
    s.dataset.mapgl = "1";
    s.onload = () =>
      window.mapgl ? resolve(window.mapgl) : reject(new Error("MapGL missing after load"));
    s.onerror = () => reject(new Error("MapGL failed to load"));
    document.head.appendChild(s);
  });
  return promise;
}
