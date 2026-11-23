import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

type Coordinate = { latitude: number; longitude: number };

export default function LocationRouteMap({ start, destination }: { start: Coordinate; destination: Coordinate }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [summary, setSummary] = useState<{ distance: number; duration: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let active = true;
    fetch(`https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`)
      .then((response) => {
        if (!response.ok) throw new Error("Route unavailable");
        return response.json();
      })
      .then((data) => {
        if (!active || !data.routes?.[0]) throw new Error("Route unavailable");
        setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
        setSummary({ distance: data.routes[0].distance, duration: data.routes[0].duration });
      })
      .catch(() => active && setError("Unable to calculate the route. You can still open the destination in Google Maps."));
    return () => { active = false; };
  }, [start.latitude, start.longitude, destination.latitude, destination.longitude]);

  if (Platform.OS !== "web") return <Text style={styles.nativeFallback}>Route map is available on the web version.</Text>;
  if (!route.length && !error) return <View style={styles.loading}><ActivityIndicator color="#D4AF37" /><Text style={styles.loadingText}>Calculating route…</Text></View>;

  return <LeafletMap start={start} destination={destination} route={route} summary={summary} error={error} />;
}

function LeafletMap({ start, destination, route, summary, error }: { start: Coordinate; destination: Coordinate; route: [number, number][]; summary: { distance: number; duration: number } | null; error: string }) {
  const [leaflet, setLeaflet] = useState<any>(null);
  useEffect(() => {
    let active = true;
    Promise.all([import("react-leaflet"), import("leaflet")]).then(([rl, L]) => active && setLeaflet({ ...rl, L: L.default || L }));
    return () => { active = false; };
  }, []);
  if (!leaflet) return <View style={styles.loading}><ActivityIndicator color="#D4AF37" /></View>;
  const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } = leaflet;
  const center: [number, number] = [(start.latitude + destination.latitude) / 2, (start.longitude + destination.longitude) / 2];
  const FitBounds = () => { const map = useMap(); useEffect(() => { map.fitBounds([[start.latitude, start.longitude], [destination.latitude, destination.longitude]], { padding: [36, 36] }); }, [map]); return null; };
  const icon = (color: string) => new leaflet.L.DivIcon({ className: "fnaad-map-marker", html: `<span style="background:${color}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  return <View style={styles.wrapper}>
    <MapContainer center={center} zoom={13} style={styles.map} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[start.latitude, start.longitude]} icon={icon("#2563EB")}><Popup>Your location</Popup></Marker>
      <Marker position={[destination.latitude, destination.longitude]} icon={icon("#B0524F")}><Popup>Client location</Popup></Marker>
      {route.length ? <Polyline positions={route} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.9 }} /> : null}
      <FitBounds />
    </MapContainer>
    <View style={styles.routeCard}><Text style={styles.routeTitle}>Route to client location</Text>{summary ? <Text style={styles.routeMeta}>{(summary.distance / 1000).toFixed(1)} km · {Math.max(1, Math.round(summary.duration / 60))} min by car</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { height: 430, overflow: "hidden", borderRadius: 18, backgroundColor: "#E5E7EB" },
  map: { height: "100%", width: "100%" },
  routeCard: { position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 12, padding: 12, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, elevation: 4 },
  routeTitle: { color: "#111827", fontSize: 14, fontWeight: "800" },
  routeMeta: { color: "#4B5563", fontSize: 12, marginTop: 4 },
  loading: { height: 430, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 13 },
  error: { color: "#B0524F", fontSize: 11, marginTop: 5 },
  nativeFallback: { color: "#6B7280", padding: 16 },
});
