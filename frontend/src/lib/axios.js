import axios from "axios";
import toast from "react-hot-toast";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api",
  withCredentials: true,
});

// Add request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Only show toast if there's a response from the server (4xx, 5xx)
    // Avoid showing toast for network-level errors or canceled requests
    if (error.response) {
      const message = error.response.data?.message || error.message || "An unexpected error occurred";
      
      // Don't show toast for common background checks or auth login (handled locally)
      const silentUrls = ["/auth/check", "/auth/login"];
      const isSilent = silentUrls.some(url => error.config?.url?.includes(url));

      if (!isSilent) {
        toast.error(message);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Network Error (No response) details:", {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      });
    }

    return Promise.reject(error);
  }
);