"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/store/user";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);

  // Function to load user profile from Supabase
  const loadUserProfile = async (userEmail: string) => {
    try {
      // Fetch nutrition profile using EMAIL as userId (your app's convention)
      const response = await fetch(`/api/nutrition/profile?userId=${encodeURIComponent(userEmail)}`);
      
      if (response.ok) {
        const profile = await response.json();
        console.log('Loaded user profile from Supabase:', profile);
        
        // Map API response to Zustand store
        const goalMapping: Record<string, string> = {
          'lose': 'Weight Loss',
          'maintain': 'Maintain Weight',
          'gain': 'Build Muscle',
        };
        
        setUser({
          email: userEmail,
          isLoggedIn: true,
          age: profile.age || 0,
          gender: profile.gender || 'Male',
          heightCm: profile.height_cm || 0,
          weightKg: profile.weight_kg || 0,
          activityLevel: profile.activity_level || 'moderately_active',
          goal: goalMapping[profile.goal] || 'Weight Loss',
          cuisinePreference: profile.cuisine_preference || null,
        });
        
        // Compute BMI
        useUserStore.getState().computeBmi();
      } else {
        console.log('No profile found, setting basic user info');
        setUser({
          email: userEmail,
          isLoggedIn: true,
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUser({
        email: userEmail,
        isLoggedIn: true,
      });
    }
  };

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      // Handle session changes
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in:', session.user.email);
        
        // Load user profile data from Supabase using EMAIL
        await loadUserProfile(session.user.email!);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        logout();
        router.push('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      } else if (event === 'USER_UPDATED') {
        console.log('User updated');
      }

      // Refresh the page to sync server-side state
      router.refresh();
    });

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        console.log('Existing session found:', session.user.email);
        // Load profile for existing session using EMAIL
        await loadUserProfile(session.user.email!);
      } else {
        console.log('No existing session');
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [router, setUser, logout]);

  return <>{children}</>;
}
