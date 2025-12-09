
export type DateFormat = 'origin' | 'jam' | 'report';

/**
 * Formats a date string into a specified format.
 * Handles "Month Day, Year, H:M AM/PM" and other standard date formats.
 * @param value The date string to format.
 * @param format The target format: 'origin', 'jam', or 'report'.
 * @returns The formatted date string, or the original value if parsing fails.
 */
export const formatDateTime = (value: any, format: DateFormat): string => {
    if (!value || typeof value !== 'string') return '';
    if (format === 'origin') return value;

    try {
        const date = new Date(value);

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            // Fallback for formats that new Date() might not parse consistently, like the specific AM/PM format.
            const dateParts = value.match(/([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4}),\s(\d{1,2}):(\d{2})\s(AM|PM)/);
            if (!dateParts) return value; // Return original if it's not the expected format either

            const [_, monthName, day, year, hourStr, minuteStr, ampm] = dateParts;
            const monthMap: { [key: string]: number } = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                'September': 8, 'October': 9, 'November': 10, 'December': 11,
            };

            let hours = parseInt(hourStr, 10);
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0; // Midnight case

            const parsedDate = new Date(parseInt(year), monthMap[monthName], parseInt(day), hours, parseInt(minuteStr));
            if (isNaN(parsedDate.getTime())) return value; // Still invalid, return original
            
            Object.assign(date, parsedDate);
        }
        
        if (format === 'report') {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }

        if (format === 'jam') {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        return value; // Should not be reached, but as a fallback
    } catch (e) {
        return value; // Return original on any error
    }
};

