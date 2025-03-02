"""
JSON schemas for deposit metadata validation.
"""

METADATA_SCHEMA = {
    "type": "object",
    "required": ["format", "versions"],
    "properties": {
        "format": {
            "type": "string",
            "description": "Format version of the metadata"
        },
        "versions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["version", "timestamp", "data"],
                "properties": {
                    "version": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "Version number"
                    },
                    "timestamp": {
                        "type": "string",
                        "format": "date-time",
                        "description": "ISO format timestamp"
                    },
                    "data": {
                        "type": "object",
                        "required": ["title"],
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Item title"
                            },
                            "description": {
                                "type": "string",
                                "description": "Item description"
                            },
                            "language": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": ["id", "name"],
                                    "properties": {
                                        "id": {
                                            "type": "string"
                                        },
                                        "name": {
                                            "type": "string"
                                        }
                                    }
                                }
                            },
                            "collaborators": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": ["id", "name", "roles"],
                                    "properties": {
                                        "id": {
                                            "type": "string"
                                        },
                                        "name": {
                                            "type": "string"
                                        },
                                        "roles": {
                                            "type": "array",
                                            "items": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
} 