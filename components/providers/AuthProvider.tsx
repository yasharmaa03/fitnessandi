"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      // Handle session changes
      if (event === 'SIGNED_IN') {
        console.log('User signed in:', session?.user?.email);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('Existing session found:', session.user.email);
      } else {
        console.log('No existing session');
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
