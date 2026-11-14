/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArchiveCatalog, CatalogViewMode, SortOption } from './components/ArchiveCatalog';
import { CuratorSection } from './components/CuratorSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PdfReaderModal } from './components/PdfReaderModal';
import { SubjectCollections } from './components/SubjectCollections';
import { UploadPaperModal } from './components/UploadPaperModal';
import { PAST_PAPERS } from './data/pastPapers';
import { ExamSystem, PaperRequest, PastPaper, SubjectName } from './types/paper';
import { deleteUploadedPdfBlob, downloadPaperPdf } from './utils/pdfService';

const STORAGE_KEYS = {
  SAVED: 'khoso_archive_saved_ids',
  SOLVED: 'khoso_archive_solved_ids',
  CUSTOM_PAPERS: 'khoso_archive_custom_papers',
  REQUESTS: 'khoso_archive_requests',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [customPapers, setCustomPapers] = useState<PastPaper[]>(() =>
    readStorage<PastPaper[]>(STORAGE_KEYS.CUSTOM_PAPERS, [])
  );
  const [savedIds, setSavedIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.SAVED, [
      'cam-math-9709-2025-mj',
      'fbise-phy-12-2025',
    ])
  );
  const [solvedIds, setSolvedIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.SOLVED, [])
  );
  const [requests, setRequests] = useState<PaperRequest[]>(() =>
    readStorage<PaperRequest[]>(STORAGE_KEYS.REQUESTS, [])
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<ExamSystem | 'All'>('All');
  const [selectedSubject, setSelectedSubject] = useState<SubjectName | 'All'>('All');
  const [selectedYear, setSelectedYear] = useState<number | 'All'>('All');
  const [viewMode, setViewMode] = useState<CatalogViewMode>('all');
  const [sortBy, setSortBy] = useState<SortOption>('year-desc');

  const [activePaper, setActivePaper] = useState<PastPaper | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    let canonicalLink = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogUrlMeta = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]'
    );
    if (!ogUrlMeta) {
      ogUrlMeta = document.createElement('meta');
      ogUrlMeta.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlMeta);
    }
    ogUrlMeta.content = canonicalUrl;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOLVED, JSON.stringify(solvedIds));
  }, [solvedIds]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.CUSTOM_PAPERS,
      JSON.stringify(customPapers)
    );
  }, [customPapers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }, [requests]);

  const allPapers = useMemo(
    () => [...customPapers, ...PAST_PAPERS],
    [customPapers]
  );

  const boardsCount = useMemo(
    () => new Set(allPapers.map((p) => p.board)).size,
    [allPapers]
  );

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => {
      setNotice((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleToggleSave = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSolved = (id: string) => {
    setSolvedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadPaper = async (
    paper: PastPaper,
    includeMarkingScheme = false
  ) => {
    setDownloadingId(paper.id);
    try {
      await downloadPaperPdf(paper, includeMarkingScheme);
      showNotice(
        `Downloaded ${paper.code} (${paper.year})${
          includeMarkingScheme ? ' Marking Scheme' : ''
        } PDF.`
      );
    } catch {
      showNotice('Could not generate the PDF file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePaperAdded = (paper: PastPaper) => {
    setCustomPapers((prev) => [paper, ...prev]);
    setViewMode('all');
    setSelectedSystem('All');
    setSelectedSubject('All');
    setSelectedYear('All');
    setSearchQuery('');
    showNotice(`Added "${paper.title}" (${paper.code}) to the archive.`);
    scrollToSection('catalog');
  };

  const handleDeleteCustomPaper = async (paper: PastPaper) => {
    setCustomPapers((prev) => prev.filter((p) => p.id !== paper.id));
    setSavedIds((prev) => prev.filter((id) => id !== paper.id));
    setSolvedIds((prev) => prev.filter((id) => id !== paper.id));
    if (paper.pdfBlobKey) {
      try {
        await deleteUploadedPdfBlob(paper.pdfBlobKey);
      } catch {
        // Ignore storage cleanup errors
      }
    }
    showNotice(`Removed "${paper.title}" from your local archive.`);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSystem('All');
    setSelectedSubject('All');
    setSelectedYear('All');
    setViewMode('all');
  };

  const handleSelectSubjectFromIndex = (subject: SubjectName) => {
    setViewMode('all');
    setSelectedSystem('All');
    setSelectedSubject(subject);
    scrollToSection('catalog');
  };

  const handleSubmitRequest = (req: Omit<PaperRequest, 'id' | 'createdAt'>) => {
    const entry: PaperRequest = {
      ...req,
      id: `req-${Date.now()}`,
      createdAt: new Date().toLocaleDateString(),
    };
    setRequests((prev) => [entry, ...prev]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-[#171615]">
      <Header
        onNavigateCatalog={() => {
          setViewMode('all');
          scrollToSection('catalog');
        }}
        onNavigateSubjects={() => scrollToSection('subjects')}
        onNavigateFolder={() => {
          setViewMode('saved');
          scrollToSection('catalog');
        }}
        onNavigateCurator={() => scrollToSection('curator')}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <main className="flex-1">
        <HeroSection
          totalPapers={allPapers.length}
          boardsCount={boardsCount}
          savedCount={savedIds.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            setViewMode('all');
            scrollToSection('catalog');
          }}
          onOpenFolderView={() => {
            setViewMode('saved');
            scrollToSection('catalog');
          }}
        />

        <ArchiveCatalog
          papers={allPapers}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSystem={selectedSystem}
          onSystemChange={setSelectedSystem}
          selectedSubject={selectedSubject}
          onSubjectChange={setSelectedSubject}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          onSortChange={setSortBy}
          savedIds={savedIds}
          solvedIds={solvedIds}
          downloadingId={downloadingId}
          onToggleSave={handleToggleSave}
          onToggleSolved={handleToggleSolved}
          onPreviewPaper={(paper) => setActivePaper(paper)}
          onDownloadPaper={(paper) => handleDownloadPaper(paper, false)}
          onDeleteCustomPaper={handleDeleteCustomPaper}
          onResetFilters={handleResetFilters}
        />

        <SubjectCollections
          papers={allPapers}
          onSelectSubject={handleSelectSubjectFromIndex}
        />

        <CuratorSection
          requests={requests}
          onSubmitRequest={handleSubmitRequest}
        />
      </main>

      <Footer
        onNavigateCatalog={() => {
          setViewMode('all');
          scrollToSection('catalog');
        }}
        onNavigateSubjects={() => scrollToSection('subjects')}
        onNavigateCurator={() => scrollToSection('curator')}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <PdfReaderModal
        paper={activePaper}
        isSaved={activePaper ? savedIds.includes(activePaper.id) : false}
        isSolved={activePaper ? solvedIds.includes(activePaper.id) : false}
        onClose={() => setActivePaper(null)}
        onToggleSave={handleToggleSave}
        onToggleSolved={handleToggleSolved}
        onDownload={(paper, includeScheme) =>
          handleDownloadPaper(paper, includeScheme)
        }
      />

      <UploadPaperModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onPaperAdded={handlePaperAdded}
      />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-3 bg-[#171615] text-white text-xs font-medium rounded-md shadow-lg border border-[#292524]"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
