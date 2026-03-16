/**
 * Questboard — Campaign store
 * Manages campaign list and current campaign details.
 */

import { create } from "zustand";
import { api } from "@/services/api";
import type { Campaign, CampaignDetail } from "@/types";

interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: CampaignDetail | null;
  loading: boolean;
  error: string | null;

  fetchCampaigns: () => Promise<void>;
  fetchCampaign: (folderName: string) => Promise<void>;
  createCampaign: (name: string, description?: string) => Promise<Campaign>;
  clearCurrent: () => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
  campaigns: [],
  currentCampaign: null,
  loading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const campaigns = await api.get<Campaign[]>("/campaigns");
      set({ campaigns, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  fetchCampaign: async (folderName) => {
    set({ loading: true, error: null });
    try {
      const campaign = await api.get<CampaignDetail>(`/campaigns/${folderName}`);
      set({ currentCampaign: campaign, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createCampaign: async (name, description = "") => {
    const campaign = await api.post<Campaign>("/campaigns", { name, description });
    set((s) => ({ campaigns: [...s.campaigns, campaign] }));
    return campaign;
  },

  clearCurrent: () => set({ currentCampaign: null }),
}));
