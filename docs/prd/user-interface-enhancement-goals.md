# User Interface Enhancement Goals

## Integration with Existing UI

The new Membership Reconciliation Dashboard must seamlessly integrate with the existing application. All new components will be built using the established frontend stack of **React 18** and **Tailwind CSS 3.4.1**. Where possible, existing shared components from the `src/components/` directory should be reused to maintain visual and interactive consistency.

## Modified/New Screens and Views

* **New Screen: Reconciliation Dashboard**: A new, admin-only page will be created to house the dashboard. This screen will contain the UI for uploading both the Lloyds Bank CSV and the Stripe transaction report, displaying the list of unreconciled payments, and presenting the "smart suggestions" for matching.
* **Modified Navigation**: A link to the new dashboard must be added to the main application navigation, visible only to users with an "admin" role.

## UI Consistency Requirements

All new UI elements must adhere to the existing visual style defined in `tailwind.config.js` and `src/app/globals.css`. The dashboard must fully support the application's existing dark mode functionality. Interactive elements like buttons, forms, and tables on the new dashboard must match the style and behavior of existing components throughout the application.

---