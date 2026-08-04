import React, { useRef, useState } from "react";
import {
  UploadCloud,
  Trash2,
  File as FileIcon,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

export function DocumentManager({
  documents,
  selectedDocIds,
  setSelectedDocIds,
  deleteDocument,
  canManageDocuments = false,
  onDocumentClick,
  fullPage = false,
  status,
  error,
  isBusy,
  url,
  setUrl,
  files,
  setFiles,
  submitUpload,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const toggleSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  return (
    <div className={fullPage ? "w-full min-h-[calc(100vh-6rem)] bg-transparent" : "w-80 shrink-0 border-l border-border/50 bg-background/40 backdrop-blur-xl h-screen overflow-y-auto hidden lg:block z-10 relative"}>
      <div className={fullPage ? "p-6 lg:p-8 space-y-6" : "p-5 space-y-6"}>
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
            <span>Knowledge Base</span>
            <Badge variant="secondary" className="font-normal text-xs">
              {documents.length}
            </Badge>
          </h3>

          {canManageDocuments ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitUpload();
              }}
              className="space-y-3"
            >
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-accent bg-accent/5 scale-[1.02]"
                    : "border-border/60 hover:border-accent/50 hover:bg-secondary/20"
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <div className="flex justify-center mb-2">
                  <UploadCloud
                    className={`w-8 h-8 ${isDragging ? "text-accent" : "text-muted-foreground"}`}
                  />
                </div>
                <p className="text-sm font-medium">Click or drag files here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, TXT, CSV up to 10MB
                </p>

                {files.length > 0 && (
                  <div className="mt-3 text-xs font-semibold text-accent bg-accent/10 py-1 px-2 rounded-md truncate">
                    {files.length} file(s) selected
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Or paste a URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isBusy}
                  className="bg-background/50 h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={isBusy || (files.length === 0 && !url)}
                className="w-full h-9 shadow-sm hover:shadow"
              >
                {isBusy ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Uploading...
                  </span>
                ) : (
                  "Upload to Knowledge Base"
                )}
              </Button>
            </form>
          ) : null}

          {status && (
            <div className="mt-3 flex items-start gap-2 text-xs text-emerald-600 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{status}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
              <XCircle className="w-4 h-4 shrink-0" />
              <span className="wrap-break-word">{error}</span>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Available Documents
          </h4>
          <div className={fullPage ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
            {documents.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border/50 col-span-full">
                No documents found.
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <Card
                    key={doc.id}
                    onClick={() => onDocumentClick?.(doc)}
                    className={`p-4 flex flex-col gap-3 transition-all duration-200 border ${
                      onDocumentClick ? 'cursor-pointer ' : ''
                    }${
                      isSelected
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border/40 hover:border-border/80 hover:bg-secondary/30 bg-background/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium truncate"
                          title={doc.title || doc.source}
                        >
                          {doc.title || doc.source}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {doc.source}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelection(doc.id)}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {doc.status && (
                        <Badge variant={doc.status === 'approved' ? 'secondary' : doc.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px] uppercase tracking-wider">
                          {doc.status.replace('_', ' ')}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {doc.category || 'document'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between gap-2">
                      <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown date'}</span>
                      <span>{doc.language || 'unspecified language'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {onDocumentClick ? (
                        <Button variant="outline" size="sm" className="h-8 px-3" onClick={(e) => { e.stopPropagation(); onDocumentClick(doc) }}>
                          Open
                        </Button>
                      ) : null}
                      {canManageDocuments ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive opacity-50 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocument(doc.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
