// src/components/MembershipTypeFilterPanel.tsx

import React from "react";

const MEMBERSHIP_TYPES = [
  { value: "Full", label: "Full Member" },
  { value: "Associate", label: "Associate Member" },
  { value: "Newsletter Only", label: "Newsletter Only" },
];

export type MembershipType = "Full" | "Associate" | "Newsletter Only";

interface MembershipTypeFilterPanelProps {
  selected: MembershipType[];
  onChange: (selected: MembershipType[]) => void;
  className?: string;
}

export default function MembershipTypeFilterPanel({
  selected,
  onChange,
  className = "",
}: MembershipTypeFilterPanelProps) {
  function handleToggle(type: MembershipType) {
    if (selected.includes(type)) {
      onChange(selected.filter((v) => v !== type));
    } else {
      onChange([...selected, type]);
    }
  }

  return (
    <div className={`flex gap-4 items-center ${className}`}>
      {MEMBERSHIP_TYPES.map((type) => (
        <label key={type.value} className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(type.value as MembershipType)}
            onChange={() => handleToggle(type.value as MembershipType)}
            className="w-4 h-4"
          />
          <span className="text-base">{type.label}</span>
        </label>
      ))}
    </div>
  );
}