// Type augmentation for @geoman-io/leaflet-geoman-free
// Adds the .pm property to Leaflet's Map type
import 'leaflet';

declare module 'leaflet' {
  namespace PM {
    interface MapControls {
      position?: L.ControlPosition;
      drawPolygon?: boolean;
      drawMarker?: boolean;
      drawCircle?: boolean;
      drawCircleMarker?: boolean;
      drawRectangle?: boolean;
      drawPolyline?: boolean;
      drawText?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
    }

    interface CreateEvent {
      layer: L.Layer;
      shape: string;
    }

    interface EditEvent {
      layer: L.Layer;
      shape: string;
    }
  }

  interface Map {
    pm: {
      addControls(options?: PM.MapControls): void;
      removeControls(): void;
      globalEditMode(): void;
      setPathOptions(options: L.PathOptions): void;
    };
  }
}
