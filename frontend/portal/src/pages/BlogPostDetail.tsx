import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Tag, Calendar, Share2, ShieldCheck } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogPosts';

export default function BlogPostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <ShieldCheck size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Post Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>The blog post you are looking for does not exist or has been moved.</p>
        <button 
          onClick={() => navigate('/blog')} 
          style={{
            background: 'var(--sky)',
            color: 'var(--navy)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          Back to Blog Feed
        </button>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Copied link to clipboard!');
  };

  return (
    <div className="dashboard-container animate-fade-up" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Back Button & Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <button 
          onClick={() => navigate('/blog')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px', 
            fontFamily: 'inherit',
            padding: 0
          }}
          className="btn-link"
        >
          <ArrowLeft size={16} /> Back to Blog Feed
        </button>

        <button 
          onClick={handleShare}
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'inherit',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; 
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.borderColor = 'var(--glass-border)'; 
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Share2 size={14} /> Share Article
        </button>
      </div>

      {/* Post Meta Header */}
      <header style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '12px', 
            fontWeight: 600, 
            color: post.category === 'Security' ? 'var(--danger)' : post.category === 'Compliance Guide' ? 'var(--warning)' : 'var(--success)',
            background: post.category === 'Security' ? 'rgba(255, 23, 68, 0.08)' : post.category === 'Compliance Guide' ? 'rgba(255, 214, 0, 0.08)' : 'rgba(0, 230, 118, 0.08)',
            padding: '4px 10px',
            borderRadius: '12px',
            border: `1px solid ${post.category === 'Security' ? 'rgba(255, 23, 68, 0.15)' : post.category === 'Compliance Guide' ? 'rgba(255, 214, 0, 0.15)' : 'rgba(0, 230, 118, 0.15)'}`
          }}>
            <Tag size={12} />
            {post.category}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            <Calendar size={13} />
            {post.publishedAt}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            <Clock size={13} />
            {post.readTime}
          </span>
        </div>

        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: 700, 
          color: 'var(--text-primary)', 
          lineHeight: '1.25', 
          marginBottom: '24px' 
        }}>
          {post.title}
        </h1>

        {/* Author Bio Widget */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '16px 20px'
        }}>
          <div style={{ 
            background: 'var(--mid-light)', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid var(--glass-border)'
          }}>
            <User size={20} color="var(--sky)" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{post.author.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{post.author.role}</div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <article className="blog-content-body" style={{ 
        fontSize: '16px', 
        lineHeight: '1.8', 
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)'
      }}>
        {post.content.map((block, index) => {
          switch (block.type) {
            case 'paragraph':
              return (
                <p key={index} style={{ marginBottom: '24px', color: '#E2E8F0' }}>
                  {block.text}
                </p>
              );
            case 'heading':
              return (
                <h2 key={index} style={{ 
                  fontSize: '22px', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)', 
                  marginTop: '40px', 
                  marginBottom: '20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingBottom: '8px'
                }}>
                  {block.text}
                </h2>
              );
            case 'list':
              return (
                <ul key={index} style={{ 
                  marginBottom: '24px', 
                  paddingLeft: '24px', 
                  listStyleType: 'disc',
                  color: '#E2E8F0'
                }}>
                  {(block.text as string[]).map((item, itemIdx) => (
                    <li key={itemIdx} style={{ marginBottom: '10px' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              );
            case 'code':
              return (
                <pre key={index} style={{ 
                  background: 'rgba(10, 15, 28, 0.8)', 
                  border: '1px solid var(--glass-border)',
                  padding: '16px 20px', 
                  borderRadius: '8px', 
                  overflowX: 'auto', 
                  marginBottom: '24px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--sky)'
                }}>
                  <code>{block.text}</code>
                </pre>
              );
            case 'quote':
              return (
                <blockquote key={index} style={{ 
                  borderLeft: '4px solid var(--sky)', 
                  paddingLeft: '20px', 
                  fontStyle: 'italic', 
                  fontSize: '18px',
                  color: 'var(--text-secondary)',
                  marginTop: '32px',
                  marginBottom: '32px'
                }}>
                  {block.text}
                </blockquote>
              );
            default:
              return null;
          }
        })}
      </article>

      {/* Footer CTA */}
      <footer style={{ 
        marginTop: '60px', 
        paddingTop: '40px', 
        borderTop: '1px solid var(--glass-border)',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Want to review observable privacy signals on your website?
        </p>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--sky)',
            padding: '12px 28px',
            borderRadius: '24px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'inherit',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.borderColor = 'var(--sky)'; 
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.15)';
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.borderColor = 'var(--glass-border)'; 
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Open compliance dashboard
        </button>
      </footer>
    </div>
  );
}
