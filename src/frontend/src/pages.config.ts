import Layout from "./Layout";
import PatientDashboard from "./pages/PatientDashboard";
import Patients from "./pages/Patients";
import Settings from "./pages/Settings";

export const pagesConfig = {
  mainPage: "Patients",
  Pages: {
    Patients: Patients,
    PatientProfile: PatientDashboard,
    Settings: Settings,
  },
  Layout: Layout,
};
