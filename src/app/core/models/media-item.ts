import { MediaType } from './media-type';

export interface MediaItemResponse {
  id: string;
  guestId: string;
  guestName: string;
  originalFilename: string;
  contentType: string;
  mediaType: MediaType;
  sizeBytes: number;
  caption: string | null;
  hidden: boolean;
  createdAt: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  downloadUrl: string;
}

export interface MediaUploadResponse {
  uploaded: MediaItemResponse[];
  failed: { filename: string; error: string }[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface MediaStatsResponse {
  totalItems: number;
  photos: number;
  videos: number;
  audios: number;
  totalSizeBytes: number;
  guests: number;
}
