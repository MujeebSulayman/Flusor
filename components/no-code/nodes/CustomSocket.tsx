import React from "react";
import { ClassicPreset } from "rete";

interface CustomSocketProps {
  data: ClassicPreset.Socket;
}

export function CustomSocket({ data }: CustomSocketProps) {
  return (
    <div
      data-socket-key={data.name}
      data-socket-side="input"
      className="w-3 h-3 rounded-full border-2 border-white bg-blue-500 hover:bg-blue-600 cursor-pointer relative z-10"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

export function CustomOutputSocket({ data }: CustomSocketProps) {
  return (
    <div
      data-socket-key={data.name}
      data-socket-side="output"
      className="w-3 h-3 rounded-full border-2 border-white bg-green-500 hover:bg-green-600 cursor-pointer relative z-10"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
