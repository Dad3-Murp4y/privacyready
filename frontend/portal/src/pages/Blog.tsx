import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Clock, BookOpen, User, Tag, ChevronLeft } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogPosts';
import PublicSiteLayout from '../components/layout/PublicSiteLayout';

export default function Blog() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Compliance Guide', 'Product Update', 'Security'];

  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <PublicSiteLayout title="PrivacyReady Blog | UK GDPR guides and updates" description="PrivacyReady guides, product updates and information about practical UK GDPR readiness." canonicalPath="/blog" mainClassName="blog-public">
    <div className="dashboard-container animate-fade-up">
      {/* Header */}
      <div className="dashboard-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '14px', 
              padding: '6px 12px 6px 0',
              fontFamily: 'inherit'
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
          <BookOpen size={32} color="var(--sky)" />
          <h1 className="dashboard-title" style={{ margin: 0 }}>PrivacyReady Blog</h1>
        </div>
        <p className="dashboard-subtitle">Guides, insights and updates about privacy and compliance operations</p>
      </div>

      {/* Filters & Search Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '20px', 
        flexWrap: 'wrap', 
        marginBottom: '40px' 
      }}>
        {/* Search Input */}
        <div className="search-bar" style={{ flex: '1', minWidth: 'min(280px, 100%)', maxWidth: '400px', margin: 0 }}>
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search guides and updates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? 'rgba(0, 229, 255, 0.15)' : 'var(--glass-bg)',
                color: selectedCategory === cat ? 'var(--sky)' : 'var(--text-secondary)',
                border: `1px solid ${selectedCategory === cat ? 'var(--sky)' : 'var(--glass-border)'}`,
                padding: '8px 16px',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(10px)'
}}
              onMouseEnter={(e) => {
                if (selectedCategory !== cat) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== cat) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Blog Cards Grid */}
      {filteredPosts.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
          gap: '30px'
        }}>
          {filteredPosts.map((post, index) => (
            <article 
              key={post.id}
              className={`animate-fade-up stagger-${(index % 3) + 1}`}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
}}
            >
              {/* Category & Read Time Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  <Clock size={12} />
                  {post.readTime}
                </span>
              </div>

              {/* Title & Summary */}
              <h2 className="post-card-title" style={{ 
                fontSize: '20px', 
                fontWeight: 600, 
                color: 'var(--text-primary)', 
                marginBottom: '12px',
                lineHeight: '1.4',
                transition: 'color 0.3s ease'
              }}>
                {post.title}
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.6', 
                marginBottom: '24px',
                flexGrow: 1
              }}>
                {post.summary}
              </p>

              {/* Author and CTA */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--glass-border)',
                marginTop: 'auto'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    background: 'var(--mid-light)', 
                    borderRadius: '50%', 
                    width: '32px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid var(--glass-border)'
                  }}>
                    <User size={16} color="var(--sky)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{post.author.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{post.publishedAt}</div>
                  </div>
                </div>
                <Link to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`} style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '13px', 
                  color: 'var(--sky)', 
                  fontWeight: 500
                }}>
                  Read Post <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ 
          background: 'var(--glass-bg)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', 
          borderRadius: '16px', 
          padding: '48px', 
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No articles match your search criteria.</p>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--sky)', 
              cursor: 'pointer', 
              textDecoration: 'underline',
              fontFamily: 'inherit',
              fontWeight: 500
            }}
          >
            Clear filters and search
          </button>
        </div>
      )}
    </div>
    </PublicSiteLayout>
  );
}
