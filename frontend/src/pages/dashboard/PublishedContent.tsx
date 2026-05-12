import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface PublishedPost { id: string; platform: string; content: string; published_at: string; status: string }

const PublishedContent: React.FC = () => {
  const { session } = useAuth();
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const tok = session?.access_token || '';
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API}/v1/analytics`, { headers: { Authorization: `Bearer ${tok}` } }).catch(() => null);
      if (res?.ok) { const d = await res.json(); setPosts(d.top_posts || []); }
      setLoading(false);
    };
    load();
  }, []);

  const PLAT_COLOR: Record<string, string> = { twitter: '#1DA1F2', linkedin: '#0A66C2', email: '#F97316' };

  return (
    <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>Published</p>
      <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 32px', color: '#fff' }}>Your Posts</h1>
      {loading ? <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</p> : posts.length === 0
        ? <p style={{ color: 'rgba(255,255,255,0.3)' }}>No published posts yet. Create your first campaign.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((p: any) => (
            <div key={p.post_id || p.id} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: PLAT_COLOR[p.platform] || '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0, marginTop: 2 }}>{p.platform}</span>
              <p style={{ margin: 0, flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{p.content_preview || p.content}</p>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#EAFF00' }}>♥ {p.likes ?? 0}</p>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{new Date(p.published_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
};

export default PublishedContent;
