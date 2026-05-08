const myProjects = [
    {
        id: "motion-poster",
        title: "Motion Poster",
        subtitle: "Atmospheric, living digital centerpieces bring immersive art to high-end events and venues. Now with multiple themes.",
        tags: [
            { label: "Recently Updated", color: "gold" },
            { label: "Digital Signage", color: "purple" },
            { label: "Project", color: "gray" }
        ],
        featured: true,
        size: "large",
        image: "assets/motion-poster-framed.png",
        imageClass: "poster-preview-img",
        actionText: "Launch Motion Poster",
        actionUrl: "https://motionposter.ryanmarch.me",
        sourceUrl: "https://github.com/RyanMarch/motionEventPoster",
        hasExtendedContent: false
    },
    {
        id: "bowserstack",
        title: "Bowserstack",
        subtitle: "An interactive Bowserstack testing tool to help get to the bottom of web-based issues.",
        tags: [
            { label: "Completed", color: "green" },
            { label: "Experimentation", color: "pink" },
            { label: "Project", color: "gray" }
        ],
        featured: false,
        size: "medium",
        image: "assets/bowser-icon.png",
        imageClass: "bowser-preview-img",
        actionText: "Launch Bowserstack",
        actionUrl: "https://bowserstack.ryanmarch.me",
        sourceUrl: "https://github.com/RyanMarch/bowserstack",
        hasExtendedContent: false
    },
    {
        id: "rentpress",
        title: "RentPress for Apartments",
        subtitle: "A comprehensive property management and marketing solution to build the ultimate online leasing office.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Platform", color: "purple" },
            { label: "Real Estate", color: "teal", priority: "low" }
        ],
        featured: false,
        size: "large",
        image: "content/rentpress/images/floor-plan-grid.webp",
        imageClass: "destination-icon",
        actionText: "Visit RentPress.io",
        actionUrl: "https://rentpress.io",
        sourceUrl: "https://wordpress.org/plugins/rentpress-for-websites/",
        hasExtendedContent: true
    },
    {
        id: "rentpress-local",
        title: "RentPress Local",
        subtitle: "Local listings management product for all maps.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Product", color: "gray" }
        ],
        featured: false,
        size: "tall",
        image: "content/rentpress-local/images/rentpress-page-schema-phones-double.png",
        imageClass: "destination-icon",
        actionText: "Visit RentPress Local",
        actionUrl: "https://rentpress.io/local/",
        hasExtendedContent: true
    },
    {
        id: "rentpress-lead-sync",
        title: "RentPress Lead Sync",   
        subtitle: "Send and receive leads without writing code.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Product", color: "gray" }
        ],
        featured: false,
        size: "tall",
        image: "content/rentpress-lead-sync/images/lead-sync-icon.png",
        imageClass: "destination-icon",
        actionText: "View Plugin",
        actionUrl: "https://wordpress.org/plugins/rentpress-gravity-forms-add-on/",
        sourceUrl: "https://support.30lines.com/documentation/rentpress-gravity-forms-add-on/",
        hasExtendedContent: true
    },
    {
        id: "amenities-manager",
        title: "Amenities Manager",
        subtitle: "Powerful control over property amenities and features for multifamily websites.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Add-On", color: "gray" },
        ],
        featured: false,
        size: "medium",
        image: "content/amenities-manager/images/amenities-icon.png",
        imageClass: "destination-icon",
        actionText: "View Plugin",
        actionUrl: "https://wordpress.org/plugins/rentpress-amenities-manager-add-on/",
        sourceUrl: "https://support.30lines.com/documentation/rentpress-amenities-manager-add-on/",
        hasExtendedContent: true
    },
    // {
    //     id: "rentpress-data-hub",
    //     title: "RentPress Data Hub",
    //     subtitle: "Server-side component connecting RentPress with third-party property management APIs.",
    //     tags: [
    //         { label: "Professional", color: "blue" },
    //         { label: "Real Estate", color: "teal", priority: "low" },
    //         { label: "Backend", color: "purple" }
    //     ],
    //     featured: false,
    //     size: "wide",
    //     image: "assets/bowser-icon.png",
    //     imageClass: "destination-icon",
    //     actionText: "Learn More",
    //     actionUrl: "#",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "rentpress-email",
    //     title: "RentPress Email",
    //     subtitle: "Connects property management CRMs to deliver leads and manage email campaigns.",
    //     tags: [
    //         { label: "Professional", color: "blue" },
    //         { label: "Real Estate", color: "teal", priority: "low" },
    //         { label: "Product", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "assets/bowser-icon.png",
    //     imageClass: "destination-icon",
    //     actionText: "Learn More",
    //     actionUrl: "#",
    //     hasExtendedContent: true
    // }
];

