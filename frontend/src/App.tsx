import { Routes, Route, Navigate } from "react-router-dom";
import DMLayout from "@/views/dm/DMLayout";
import PlayerLayout from "@/views/player/PlayerLayout";

export default function App() {
  return (
    <Routes>
      {/* DM routes */}
      <Route path="/dm/*" element={<DMLayout />} />

      {/* Player routes */}
      <Route path="/play/*" element={<PlayerLayout />} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dm" replace />} />
    </Routes>
  );
}
