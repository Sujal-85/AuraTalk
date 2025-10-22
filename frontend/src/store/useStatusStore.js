import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { axiosInstance } from '../lib/axios';

export const useStatusStore = create(persist((set, get) => ({
  myStatuses: [],
  feedStatuses: [],
  isLoading: false,
  error: null,

  fetchFeed: async () => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await axiosInstance.get('/status/feed');
      set({ feedStatuses: data?.statuses || [], isLoading: false });
    } catch (e) {
      set({ error: e?.response?.data?.message || e.message, isLoading: false });
    }
  },

  fetchMine: async () => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await axiosInstance.get('/status/mine');
      set({ myStatuses: data?.statuses || [], isLoading: false });
    } catch (e) {
      set({ error: e?.response?.data?.message || e.message, isLoading: false });
    }
  },

  postTextStatus: async (text) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await axiosInstance.post('/status', { type: 'text', text });
      set({ myStatuses: [data?.status, ...get().myStatuses], isLoading: false });
    } catch (e) {
      set({ error: e?.response?.data?.message || e.message, isLoading: false });
    }
  },

  postMediaStatus: async (file) => {
    try {
      set({ isLoading: true, error: null });
      const form = new FormData();
      form.append('file', file);
      form.append('type', file.type.startsWith('video') ? 'video' : 'image');
      const { data } = await axiosInstance.post('/status', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      set({ myStatuses: [data?.status, ...get().myStatuses], isLoading: false });
    } catch (e) {
      set({ error: e?.response?.data?.message || e.message, isLoading: false });
    }
  },

  deleteStatus: async (id) => {
    try {
      await axiosInstance.delete(`/status/${id}`);
      set({ myStatuses: get().myStatuses.filter(s => s._id !== id) });
    } catch (e) {
      set({ error: e?.response?.data?.message || e.message });
    }
  }
}), { name: 'status-store' }));
