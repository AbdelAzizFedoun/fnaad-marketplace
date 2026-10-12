import { Tabs } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import TabBarIcon from "../components/TabBarIcon";
import React from "react";

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="home" inactiveIcon="home-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoris",
          headerShown: true,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="heart" inactiveIcon="heart-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: "Messages",
          headerShown: true,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="chatbubble" inactiveIcon="chatbubble-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="atelier"
        options={{
          title: "Atelier",
          headerShown: true,
          href: user?.is_artist ? "/atelier" : null,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="color-palette" inactiveIcon="color-palette-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
          headerShown: true,
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon activeIcon="person" inactiveIcon="person-outline" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
