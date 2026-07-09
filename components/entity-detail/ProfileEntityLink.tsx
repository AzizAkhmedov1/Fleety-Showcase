"use client";
import React from "react";
import { PROFILE_ENTITY_LINK_CLASS } from "@/components/entity-detail/profile-field-styles";
interface ProfileEntityLinkProps {
    label: string;
    onClick: () => void;
    className?: string;
}
export default function ProfileEntityLink({ label, onClick, className = PROFILE_ENTITY_LINK_CLASS, }: ProfileEntityLinkProps) {
    return (<button type="button" onClick={onClick} className={className}>
      {label}
    </button>);
}
