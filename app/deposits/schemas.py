"""
JSON schemas for deposit metadata validation.
"""

from typing import List, Dict, Optional, Any, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid

# Helper models for nested structures
class FileSchema(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    filetype: str
    access_level: str
    title: Optional[str] = None
    duration: Optional[float] = None
    filesize: int
    creation_date: Optional[str] = None
    languages: Optional[List[str]] = None
    collaborators: Optional[List[str]] = None

class ItemSchema(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: Optional[str] = None
    catalog_number: str
    item_access_level: str
    resource_type: str
    genre: Optional[List[str]] = None
    language_description_type: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    collaborators: Optional[List[str]] = None
    files: List[FileSchema] = []

class CollectionSchema(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: Optional[str] = None
    collection_abbr: str
    name: str
    extent: Optional[str] = None
    abstract: Optional[str] = None
    description: Optional[str] = None
    background: Optional[str] = None
    conventions: Optional[str] = None
    acquisition: Optional[str] = None
    access_statement: Optional[str] = None
    citation_authors: Optional[str] = None
    access_levels: Optional[List[str]] = None
    genres: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    items: List[ItemSchema] = []

class CollaboratorSchema(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collaborator_id: Optional[int] = None
    name: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None
    native_languages: Optional[List[str]] = None
    other_languages: Optional[List[str]] = None
    tribal_affiliations: Optional[str] = None
    origin: Optional[str] = None

class VersionDataSchema(BaseModel):
    collections: List[CollectionSchema] = []
    collaborators: List[CollaboratorSchema] = []

class VersionSchema(BaseModel):
    version: int
    state: str
    timestamp: str
    modified_by: str
    is_draft: Optional[bool] = False
    comment: Optional[str] = None
    data: Dict[str, Any]

class DepositMetadataSchema(BaseModel):
    format: str
    deposit_id: Optional[str] = None
    versions: List[VersionSchema]

    @validator('versions')
    def sort_versions(cls, v):
        """Ensure versions are sorted in descending order (newest first)"""
        return sorted(v, key=lambda x: x.version, reverse=True)

# Schema for creating a new deposit
class DepositCreateSchema(BaseModel):
    title: str
    description: Optional[str] = None
    access_level: Optional[str] = None
    
# Schema for updating a deposit
class DepositUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    access_level: Optional[str] = None
    state: Optional[str] = None
    comment: Optional[str] = None

# Schema for file upload
class FileUploadSchema(BaseModel):
    filename: str
    deposit: int
    item_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    access_level: Optional[str] = "1"  # Default to public access

# Schema for file update
class FileUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    access_level: Optional[str] = None
    item_id: Optional[str] = None

# Schema for collection creation
class CollectionCreateSchema(BaseModel):
    name: str
    collection_abbr: str
    abstract: Optional[str] = None
    description: Optional[str] = None
    access_levels: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    genres: Optional[List[str]] = None

# Schema for item creation
class ItemCreateSchema(BaseModel):
    catalog_number: str
    resource_type: str
    item_access_level: str
    collection_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    language_description_type: Optional[List[str]] = None
    collaborators: Optional[List[str]] = None

# Schema for collaborator creation
class CollaboratorCreateSchema(BaseModel):
    name: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None
    native_languages: Optional[List[str]] = None
    other_languages: Optional[List[str]] = None
    tribal_affiliations: Optional[str] = None
    origin: Optional[str] = None 