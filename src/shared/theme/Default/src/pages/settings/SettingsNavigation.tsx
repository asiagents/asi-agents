import React from 'react';
import { SettingsSection } from '../../components/settings/SettingsUI';
import { NavSettings } from '../../components/settings/NavSettings';

export function SettingsNavigation() {
  return (
    <SettingsSection
      title="Bottom menu"
      description="Drag or use the arrows to reorder. Home and Settings always stay. Add catalog pages or custom label + path/URL links for the bottom menu and/or settings left sidebar."
    >
      <NavSettings />
    </SettingsSection>
  );
}