import { Mail, Phone } from "lucide-react";

export const EXPERTS = [
    {
        name: "Loris Cavalieri",
        role: "Personal Trainer spécialisé dans les transitions hormonales féminines",
        offer: "Bilan Ménopause Offert",
        description:
            "45 min pour comprendre ce qui se passe et repartir avec un plan d’action concret.",
        code: "BAUME_LORIS",
        contactType: "Téléphone",
        contactIcon: Phone,
        image: "/images/image-loris-cavalieri.webp",
        sections: [
            {
                title: "Qui est Loris ?",
                text: "Personal Trainer à Genève depuis 9 ans. Reconverti par passion après un voyage fondateur en Thaïlande, il accompagne les femmes dans les transitions hormonales, notamment la péri-ménopause et la ménopause.",
            },
            {
                title: "Pourquoi cette spécialisation ?",
                text: "Face à de nombreuses clientes touchées par la péri-ménopause ou la ménopause, Loris a choisi de se former en profondeur pour proposer un accompagnement concret, humain et adapté.",
            },
            {
                title: "Comment il travaille ?",
                text: "Son suivi individuel, en cabinet à Genève ou en ligne, aide à retrouver de l’énergie, mieux dormir, gérer le stress, renforcer son corps et reprendre confiance. En 12 semaines, l’objectif est de repartir avec un corps plus fort et une meilleure compréhension de soi.",
            },
            {
                title: "Comment utiliser le code promo ?",
                text: "Contacte Loris directement par téléphone en mentionnant ton code promo Baume au moment de la prise de rendez-vous.",
            },
        ],
    },

    {
        name: "Alicia Orelli",
        role: "Coach spécialisée dans la reconnexion au corps, à l’intimité et à la puissance intérieure",
        offer: "Séance découverte offerte",
        description:
            "Un espace pour te poser, être entendue, et comprendre quel accompagnement te correspond vraiment.",
        code: "BAUME_ALICIA",
        contactType: "Email : info@feminisance.ch",
        contactIcon: Mail,
        image: "/images/image-alicia-orelli.webp",
        sections: [
            {
                title: "Qui est Alicia ?",
                text: "Alicia accompagne les femmes dans la reconnexion à leur corps, leur intimité et leur puissance intérieure. Son parcours personnel autour du vaginisme, de l’endométriose, des ovaires polykystiques et de la PMA nourrit aujourd’hui son approche.",
            },
            {
                title: "Pourquoi cette spécialisation ?",
                text: "Après des années d’errance médicale et de honte silencieuse, Alicia a fait de son expérience une mission : permettre à chaque femme d’accéder aux ressources et à l’accompagnement dont elle aurait eu besoin plus tôt.",
            },
            {
                title: "Comment elle travaille ?",
                text: "Son approche est holistique, humaine et sans jugement. Elle propose des coachings individuels, des cercles de parole et des ressources en ligne pour accompagner le vaginisme, le cycle, la PMA ou simplement la reconnexion à soi.",
            },
            {
                title: "Comment utiliser le code ?",
                text: "Contacte Alicia directement par email en mentionnant ton code promo Baume au moment de la prise de rendez-vous.",
            },
        ],
    },
];